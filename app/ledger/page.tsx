"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import Ledger from "@/components/Ledger";
import { getTrades, activateTrade, closeTrade } from "@/lib/db/trades";
import type { Trade } from "@/lib/db/trades";

const POLL_INTERVAL_MS = 15 * 60 * 1000;

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
  const { user, loading: authLoading } = useAuth();

  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [livePrices,    setLivePrices]    = useState<Record<string, number>>({});
  const [pricesLoading, setPricesLoading] = useState(false);
  const [lastChecked,   setLastChecked]   = useState<Date | null>(null);

  const userIdRef = useRef<string | null>(null);
  const tradesRef = useRef<Trade[]>([]);

  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user]);
  useEffect(() => { tradesRef.current = trades; }, [trades]);

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

  const runMonitor = useCallback(async (
    currentTrades: Trade[],
    prices: Record<string, number>
  ): Promise<boolean> => {
    const actions: Promise<void>[] = [];

    for (const trade of currentTrades) {
      const ltp = prices[trade.ticker];
      if (ltp === undefined) continue;

      if (trade.status === "QUEUED" && trade.entry_target !== null) {
        if (ltp >= trade.entry_target) {
          console.log(`[monitor] Activating ${trade.ticker}`);
          actions.push(activateTrade(trade.id));
        }
      }

      if (trade.status === "OPEN") {
        const target = trade.target ?? trade.entry_price + 2 * (trade.entry_price - trade.stop_loss);
        if (ltp >= target) {
          actions.push(closeTrade(trade.id, "TARGET_HIT", ltp, trade.quantity, trade.entry_price));
        } else if (ltp <= trade.stop_loss) {
          actions.push(closeTrade(trade.id, "STOPPED", ltp, trade.quantity, trade.entry_price));
        }
      }
    }

    if (actions.length > 0) {
      await Promise.allSettled(actions);
      return true;
    }
    return false;
  }, []);

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

  // ── Bootstrap: wait for auth, then load trades ────────────
  useEffect(() => {
    if (authLoading) return;           // wait for auth to resolve
    if (!user) {
      setLoading(false);
      setError("Please sign in to view your ledger.");
      return;
    }
    userIdRef.current = user.id;
    refresh(user.id).finally(() => setLoading(false));
  }, [user, authLoading, refresh]);

  // ── 15-min polling ────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const [filter, setFilter] = useState<Trade["status"] | "ALL">("ALL");

  const open      = trades.filter(t => t.status === "OPEN").length;
  const queued    = trades.filter(t => t.status === "QUEUED").length;
  const closed    = trades.filter(t => t.status === "CLOSED").length;
  const stopped   = trades.filter(t => t.status === "STOPPED").length;
  const targetHit = trades.filter(t => t.status === "TARGET_HIT").length;

  const filteredTrades = filter === "ALL" ? trades : trades.filter(t => t.status === filter);

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Trade Ledger</h1>
          <p className="text-sm text-slate-400 dark:text-slate-400">
            Prices refresh every 15 minutes automatically while this page is open.
          </p>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-2 flex-wrap">
            {(["ALL", "OPEN", "QUEUED", "CLOSED", "STOPPED", "TARGET_HIT"] as const)
              .filter(s => {
                if (s === "ALL")        return true;
                if (s === "OPEN")       return open > 0;
                if (s === "QUEUED")     return queued > 0;
                if (s === "CLOSED")     return closed > 0;
                if (s === "STOPPED")    return stopped > 0;
                if (s === "TARGET_HIT") return targetHit > 0;
              })
              .map(s => {
                const active = filter === s;
                const base   = "text-xs px-3 py-1 rounded-full border font-medium transition-all cursor-pointer select-none";

                const styles: Record<string, string> = {
                  ALL:        active
                    ? "border-slate-500 dark:border-slate-400 text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-700"
                    : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
                  OPEN:       active
                    ? "border-emerald-500 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/40"
                    : "border-emerald-400 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
                  QUEUED:     active
                    ? "border-amber-500 dark:border-amber-400 text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40"
                    : "border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40",
                  CLOSED:     active
                    ? "border-slate-500 dark:border-slate-400 text-slate-800 dark:text-slate-200 bg-slate-200 dark:bg-slate-700"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-700",
                  STOPPED:    active
                    ? "border-red-500 dark:border-red-500 text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/40"
                    : "border-red-400 dark:border-red-800 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40",
                  TARGET_HIT: active
                    ? "border-blue-500 dark:border-blue-400 text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40"
                    : "border-blue-400 dark:border-blue-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40",
                };

                const counts: Record<string, string> = {
                  ALL:        `All (${trades.length})`,
                  OPEN:       `${open} Open`,
                  QUEUED:     `${queued} Queued`,
                  CLOSED:     `${closed} Closed`,
                  STOPPED:    `${stopped} SL Hit`,
                  TARGET_HIT: `${targetHit} TG Hit`,
                };

                return (
                  <button
                    key={s}
                    onClick={() => setFilter(f => f === s ? "ALL" : s)}
                    className={`${base} ${styles[s]}`}
                  >
                    {s === "QUEUED" && (
                      <ClockIcon className="w-3 h-3 inline-block mr-1 -mt-0.5"/>
                    )}
                    {counts[s]}
                  </button>
                );
              })}
          </div>
          {lastChecked && (
            <span className="text-xs text-slate-400 dark:text-slate-600 flex items-center gap-1">
              <ClockIcon className="w-3 h-3"/>
              Last checked {lastChecked.toLocaleTimeString("en-IN", {
                hour: "2-digit", minute: "2-digit", second: "2-digit",
              })}
            </span>
          )}
        </div>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 backdrop-blur p-6 shadow-xl">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400 dark:text-slate-500">
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
              trades={filteredTrades}
              livePrices={livePrices}
              pricesLoading={pricesLoading}
              onRefresh={() => refresh()}
              emptyMessage={filter !== "ALL" ? `No ${filter.replace("_", " ").toLowerCase()} trades.` : undefined}
            />
          )}
        </section>

      </div>
    </main>
  );
}