"use client";

import { useState, useEffect } from "react";
import Ledger from "@/components/Ledger";
import { getAnonymousId, ensureUser } from "@/lib/user";
import { getTrades } from "@/lib/db/trades";
import type { Trade } from "@/lib/db/trades";

export default function LedgerPage() {
  const [userId,    setUserId]    = useState<string | null>(null);
  const [trades,    setTrades]    = useState<Trade[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  // Map of ticker → live price, fetched for all OPEN trades on load
  const [livePrices,      setLivePrices]      = useState<Record<string, number>>({});
  const [pricesLoading,   setPricesLoading]   = useState(false);

  useEffect(() => {
    async function bootstrap() {
      try {
        const anonymousId = getAnonymousId();
        const uid         = await ensureUser(anonymousId);
        setUserId(uid);
        const data = await getTrades(uid);
        setTrades(data);
        // Fetch live prices for open trades after loading
        await fetchLivePrices(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ledger.");
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  /**
   * Fetches live prices for all OPEN trades in parallel.
   * Deduplicates tickers so we don't double-fetch the same stock.
   */
  async function fetchLivePrices(allTrades: Trade[]) {
    const openTrades  = allTrades.filter(t => t.status === "OPEN");
    const uniqueTickers = [...new Set(openTrades.map(t => t.ticker))];
    if (uniqueTickers.length === 0) return;

    setPricesLoading(true);
    try {
      const results = await Promise.allSettled(
        uniqueTickers.map(async ticker => {
          const res  = await fetch(`/api/search-stocks?ticker=${encodeURIComponent(ticker)}`);
          const data = await res.json();
          return { ticker, price: data.success ? (data.price as number) : null };
        })
      );

      const priceMap: Record<string, number> = {};
      results.forEach(r => {
        if (r.status === "fulfilled" && r.value.price !== null) {
          priceMap[r.value.ticker] = r.value.price;
        }
      });
      setLivePrices(priceMap);
    } catch (err) {
      console.error("Failed to fetch live prices:", err);
    } finally {
      setPricesLoading(false);
    }
  }

  async function refresh() {
    if (!userId) return;
    try {
      const data = await getTrades(userId);
      setTrades(data);
      await fetchLivePrices(data);
    } catch (err) {
      console.error(err);
    }
  }

  const open    = trades.filter(t => t.status === "OPEN").length;
  const closed  = trades.filter(t => t.status === "CLOSED").length;
  const stopped = trades.filter(t => t.status === "STOPPED").length;

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Trade Ledger</h1>
          <p className="text-sm text-slate-400">
            Your saved positions — persistent across sessions, no sign-in required.
          </p>
        </div>

        {trades.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <span className="text-xs px-3 py-1 rounded-full border border-emerald-700
              text-emerald-400 bg-emerald-900/20">{open} Open</span>
            <span className="text-xs px-3 py-1 rounded-full border border-slate-600
              text-slate-400 bg-slate-800">{closed} Closed</span>
            <span className="text-xs px-3 py-1 rounded-full border border-red-800
              text-red-400 bg-red-900/20">{stopped} SL Hit</span>
          </div>
        )}

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
              onRefresh={refresh}
            />
          )}
        </section>

      </div>
    </main>
  );
}