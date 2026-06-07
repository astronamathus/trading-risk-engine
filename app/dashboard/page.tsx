"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAnonymousId, ensureUser } from "@/lib/user";
import { getTrades, activateTrade, closeTrade } from "@/lib/db/trades";
import type { Trade } from "@/lib/db/trades";
import FloatingBar        from "@/components/dashboard/FloatingBar";
import SummaryCards       from "@/components/dashboard/SummaryCards";
import EquityCurve        from "@/components/dashboard/EquityCurve";
import HoldingsPieChart   from "@/components/dashboard/HoldingsPieChart";
import RiskTable          from "@/components/dashboard/RiskTable";

const POLL_MS = 15 * 60 * 1000;

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
  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [livePrices,    setLivePrices]    = useState<Record<string, number>>({});
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [lastUpdated,   setLastUpdated]   = useState<Date | null>(null);
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

  const refresh = useCallback(async (uid?: string) => {
    const id = uid ?? userIdRef.current;
    if (!id) return;
    setRefreshing(true);
    try {
      const data   = await getTrades(id);
      const prices = await fetchPrices(data);
      setTrades(data);
      setLivePrices(prices);
      setLastUpdated(new Date());

      // Run monitor — same logic as ledger page
      const actions: Promise<void>[] = [];
      for (const trade of data) {
        const ltp = prices[trade.ticker];
        if (ltp === undefined) continue;

        if (trade.status === "QUEUED" && trade.entry_target !== null) {
          if (ltp >= trade.entry_target) actions.push(activateTrade(trade.id));
        }

        if (trade.status === "OPEN") {
          const target = trade.entry_price + 2 * (trade.entry_price - trade.stop_loss);
          if (ltp >= target) {
            actions.push(closeTrade(trade.id, "TARGET_HIT" as any, ltp, trade.quantity, trade.entry_price));
          } else if (ltp <= trade.stop_loss) {
            actions.push(closeTrade(trade.id, "STOPPED", ltp, trade.quantity, trade.entry_price));
          }
        }
      }
      if (actions.length > 0) {
        await Promise.allSettled(actions);
        const updated = await getTrades(id);
        setTrades(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    async function bootstrap() {
      try {
        const anonymousId = getAnonymousId();
        const uid         = await ensureUser(anonymousId);
        userIdRef.current = uid;
        await refresh(uid);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-500">
        <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-sm">Loading dashboard…</span>
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">

        {/* Floating bar */}
        <FloatingBar trades={trades} livePrices={livePrices}/>

        {/* Page header */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
            {lastUpdated && (
              <p className="text-xs text-slate-600 mt-0.5">
                Updated {lastUpdated.toLocaleTimeString("en-IN", {
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })} · refreshes every 15 min
              </p>
            )}
          </div>
          <button
            onClick={() => refresh()}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-600
              text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800
              transition-colors disabled:opacity-40"
          >
            <RefreshIcon spinning={refreshing}/>
            Refresh
          </button>
        </div>

        {/* Summary cards */}
        <SummaryCards trades={trades} livePrices={livePrices}/>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <EquityCurve trades={trades} livePrices={livePrices}/>
          </div>
          <div className="md:col-span-1">
            <HoldingsPieChart trades={trades} livePrices={livePrices}/>
          </div>
        </div>

        {/* Risk table */}
        <RiskTable trades={trades} livePrices={livePrices}/>

      </div>
    </main>
  );
}