"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Ledger from "@/components/Ledger";
import { getAnonymousId, ensureUser } from "@/lib/user";
import { getTrades, activateTrade, closeTrade } from "@/lib/db/trades";
import type { Trade } from "@/lib/db/trades";

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Inline clock SVG — no emoji
function ClockIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6.5"/>
      <path d="M8 4.5V8l2.5 2"/>
    </svg>
  );
}

export default function LedgerPage() {
  const [userId,        setUserId]        = useState<string | null>(null);
  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [livePrices,    setLivePrices]    = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [lastChecked,   setLastChecked]   = useState<Date | null>(null);

  const userIdRef = useRef<string | null>(null);
  const tradesRef = useRef<Trade[]>([]);

  useEffect(() => { userIdRef.current = userId; },  [userId]);
  useEffect(() => { tradesRef.current = trades; }, [trades]);

  // ── Fetch live prices for OPEN + QUEUED trades ────────────
  async function fetchLivePrices(allTrades: Trade[]): Promise<Record<string, number>> {
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

    const priceMap: Record<string, number> = {};
    results.forEach(r => {
      if (r.status === "fulfilled" && r.value.price !== null)
        priceMap[r.value.ticker] = r.value.price;
    });
    return priceMap;
  }

  // ── Monitor logic ─────────────────────────────────────────
  // QUEUED → OPEN : price rises TO or ABOVE entry_target
  //   (we only queue when entry > LTP, so we always wait for price to go UP)
  // OPEN → STOPPED : price falls TO or BELOW stop_loss
  const runMonitor = useCallback(async (
    currentTrades: Trade[],
    prices: Record<string, number>
  ): Promise<boolean> => {
    const actions: Promise<void>[] = [];

    for (const trade of currentTrades) {
      const ltp = prices[trade.ticker];
      if (ltp === undefined) continue;

      if (trade.status === "QUEUED" && trade.entry_target !== null) {
        // Activate only when LTP rises UP to meet the entry target
        if (ltp >= trade.entry_target) {
          console.log(`[monitor] Activating ${trade.ticker} — LTP ${ltp} ≥ entry target ${trade.entry_target}`);
          actions.push(activateTrade(trade.id));
        }
      }

      if (trade.status === "OPEN") {
        // Stop out when LTP hits or falls below stop loss
        if (ltp <= trade.stop_loss) {
          console.log(`[monitor] Stopping ${trade.ticker} — LTP ${ltp} ≤ SL ${trade.stop_loss}`);
          actions.push(
            closeTrade(trade.id, "STOPPED", ltp, trade.quantity, trade.entry_price)
          );
        }
      }
    }

    if (actions.length > 0) {
      await Promise.allSettled(actions);
      return true;
    }
    return false;
  }, []);

  // ── Full refresh ──────────────────────────────────────────
  const refresh = useCallback(async (uid?: string) => {
    const id = uid ?? userIdRef.current;
    if (!id) return;

    try {
      const data = await getTrades(id);
      setTrades(data);
      tradesRef.current = data;

      setPricesLoading(true);
      const prices = await fetchLivePrices(data);
      setLivePrices(prices);
      setLastChecked(new Date());

      const changed = await runMonitor(data, prices);
      if (changed) {
        const updated = await getTrades(id);
        setTrades(updated);
      }
    } catch (err) {
      console.error("Refresh error:", err);
    } finally {
      setPricesLoading(false);
    }
  }, [runMonitor]);

  // ── Bootstrap ─────────────────────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      try {
        const anonymousId = getAnonymousId();
        const uid         = await ensureUser(anonymousId);
        setUserId(uid);
        userIdRef.current = uid;
        await refresh(uid);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ledger.");
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [refresh]);

  // ── 15-min polling ────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("[monitor] 15-min poll triggered");
      refresh();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const open    = trades.filter(t => t.status === "OPEN").length;
  const queued  = trades.filter(t => t.status === "QUEUED").length;
  const closed  = trades.filter(t => t.status === "CLOSED").length;
  const stopped = trades.filter(t => t.status === "STOPPED").length;

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Trade Ledger</h1>
          <p className="text-sm text-slate-400">
            Prices refresh every 15 minutes automatically while this page is open.
          </p>
        </div>

        {/* Status chips + last checked */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-3 py-1 rounded-full border border-emerald-700
              text-emerald-400 bg-emerald-900/20">{open} Open</span>
            {queued > 0 && (
              <span className="text-xs px-3 py-1 rounded-full border border-amber-700
                text-amber-400 bg-amber-900/20 flex items-center gap-1">
                <ClockIcon className="w-3 h-3"/>
                {queued} Queued
              </span>
            )}
            <span className="text-xs px-3 py-1 rounded-full border border-slate-600
              text-slate-400 bg-slate-800">{closed} Closed</span>
            <span className="text-xs px-3 py-1 rounded-full border border-red-800
              text-red-400 bg-red-900/20">{stopped} SL Hit</span>
          </div>
          {lastChecked && (
            <span className="text-xs text-slate-600 flex items-center gap-1">
              <ClockIcon className="w-3 h-3"/>
              Last checked {lastChecked.toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit", second: "2-digit",
              })}
            </span>
          )}
        </div>

        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm">Loading your trades…</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : (
            <Ledger
              trades={trades}
              livePrices={livePrices}
              pricesLoading={pricesLoading}
              onRefresh={() => refresh()}
            />
          )}
        </section>

      </div>
    </main>
  );
}