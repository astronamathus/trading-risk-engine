"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth }       from "@/components/AuthProvider";
import { supabase }     from "@/lib/supabase";
import { getTrades, getActiveTrades, activateTrade, closeTrade } from "@/lib/db/trades";
import type { Trade }    from "@/lib/db/trades";
import FloatingBar       from "@/components/dashboard/FloatingBar";
import SummaryCards      from "@/components/dashboard/SummaryCards";
import EquityCurve       from "@/components/dashboard/EquityCurve";
import TradeHealth       from "@/components/dashboard/TradeHealth";
import RiskPieChart      from "@/components/dashboard/RiskPieChart";
import RiskTable         from "@/components/dashboard/RiskTable";

const POLL_MS    = 15 * 60 * 1000;
// Dashboard shows only the most recent trades for the charts/cards.
// Full history is available in the Ledger page.
const PAGE_SIZE  = 200;

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-4 h-4 ${spinning ? "animate-spin" : ""}`}
      viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3"/>
      <path d="M13.5 2v3h-3"/>
    </svg>
  );
}

export default function DashboardPage() {
  const [trades,       setTrades]       = useState<Trade[]>([]);
  const [livePrices,   setLivePrices]   = useState<Record<string, number>>({});
  const [capitalLimit, setCapitalLimit] = useState<number | undefined>(undefined);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const userIdRef = useRef<string | null>(null);

  async function fetchPrices(allTrades: Trade[]): Promise<Record<string, number>> {
    const monitored     = allTrades.filter(t => t.status === "OPEN" || t.status === "QUEUED");
    const uniqueTickers = [...new Set(monitored.map(t => t.ticker))];
    if (uniqueTickers.length === 0) return {};
    const results = await Promise.allSettled(
      uniqueTickers.map(async ticker => {
        const res  = await fetch(`/api/search-stocks?ticker=${encodeURIComponent(ticker)}`);
        const data = await res.json();
        return { ticker, price: data.success ? (data.price as number) : null };
      })
    );
    const map: Record<string, number> = {};
    results.forEach(r => {
      if (r.status === "fulfilled" && r.value.price !== null)
        map[r.value.ticker] = r.value.price;
    });
    return map;
  }

  /**
   * Full refresh — re-fetches trade history + live prices + capital limit.
   * Used on mount and manual refresh button.
   */
  const refresh = useCallback(async (uid?: string) => {
    const id = uid ?? userIdRef.current;
    if (!id) return;
    setRefreshing(true);
    try {
      const [data, userRow] = await Promise.all([
        getTrades(id, 0, PAGE_SIZE),
        supabase.from("trader_users").select("capital_limit").eq("id", id).single(),
      ]);
      const prices = await fetchPrices(data);
      setTrades(data);
      setLivePrices(prices);
      if (userRow.data?.capital_limit) setCapitalLimit(userRow.data.capital_limit);
      setLastUpdated(new Date());

      // Monitor open/queued for auto-close triggers
      const actions: Promise<void>[] = [];
      for (const trade of data) {
        const ltp = prices[trade.ticker];
        if (ltp === undefined) continue;
        if (trade.status === "QUEUED" && trade.entry_target !== null) {
          if (ltp >= trade.entry_target) actions.push(activateTrade(trade.id));
        }
        if (trade.status === "OPEN") {
          const target = trade.entry_price + 2 * (trade.entry_price - trade.stop_loss);
          if (ltp >= target)
            actions.push(closeTrade(trade.id, "TARGET_HIT", ltp, trade.quantity, trade.entry_price));
          else if (ltp <= trade.stop_loss)
            actions.push(closeTrade(trade.id, "STOPPED", ltp, trade.quantity, trade.entry_price));
        }
      }
      if (actions.length > 0) {
        await Promise.allSettled(actions);
        const updated = await getTrades(id, 0, PAGE_SIZE);
        setTrades(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /**
   * Scoped poll — only fetches OPEN/QUEUED rows for price monitoring.
   * Does not re-fetch full trade history; just updates livePrices in place
   * and reloads history only if a trade status actually changed.
   */
  const pollActiveTrades = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) return;
    try {
      const activeTrades = await getActiveTrades(id);
      if (activeTrades.length === 0) return;

      const prices = await fetchPrices(activeTrades);
      setLivePrices(prev => ({ ...prev, ...prices }));
      setLastUpdated(new Date());

      const actions: Promise<void>[] = [];
      for (const trade of activeTrades) {
        const ltp = prices[trade.ticker];
        if (ltp === undefined) continue;
        if (trade.status === "QUEUED" && trade.entry_target !== null) {
          if (ltp >= trade.entry_target) actions.push(activateTrade(trade.id));
        }
        if (trade.status === "OPEN") {
          const target = trade.entry_price + 2 * (trade.entry_price - trade.stop_loss);
          if (ltp >= target)
            actions.push(closeTrade(trade.id, "TARGET_HIT", ltp, trade.quantity, trade.entry_price));
          else if (ltp <= trade.stop_loss)
            actions.push(closeTrade(trade.id, "STOPPED", ltp, trade.quantity, trade.entry_price));
        }
      }
      if (actions.length > 0) {
        await Promise.allSettled(actions);
        // Status changed — reload history so dashboard charts stay accurate
        const updated = await getTrades(id, 0, PAGE_SIZE);
        setTrades(updated);
      }
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, []);

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoading(false); return; }
    userIdRef.current = user.id;
    refresh(user.id).finally(() => setLoading(false));
  }, [user, authLoading, refresh]);

  // ── 15-min poll — scoped to active trades only ────────────
  useEffect(() => {
    const id = setInterval(() => pollActiveTrades(), POLL_MS);
    return () => clearInterval(id);
  }, [pollActiveTrades]);

  if (loading) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-400 dark:text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading dashboard…</span>
    </main>
  );

  if (error) return (
    <main className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      </div>
    </main>
  );

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">

        {/* Floating bar */}
        <FloatingBar trades={trades} livePrices={livePrices} capitalLimit={capitalLimit}/>

        {/* Header */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Dashboard</h1>
            {lastUpdated && (
              <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                Updated {lastUpdated.toLocaleTimeString("en-IN", {
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })} · auto-refreshes every 15 min
              </p>
            )}
          </div>
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600
              text-xs font-medium text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-white dark:bg-slate-800
              transition-colors disabled:opacity-40"
          >
            <RefreshIcon spinning={refreshing}/>
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        <SummaryCards trades={trades} livePrices={livePrices}/>

        {/* Full-width equity curve */}
        <EquityCurve trades={trades} livePrices={livePrices}/>

        {/* Trade health + Risk pie — side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TradeHealth trades={trades} livePrices={livePrices}/>
          <RiskPieChart trades={trades}/>
        </div>

        {/* Risk table — full width */}
        <RiskTable trades={trades} livePrices={livePrices}/>

      </div>
    </main>
  );
}