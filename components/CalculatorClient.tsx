"use client";

import { useState, useEffect } from "react";
import CalculatorForm from "@/components/CalculatorForm";
import ResultsPanel   from "@/components/ResultsPanel";
import SaveToLedgerButton from "@/components/SaveToLedgerButton";
import Ledger         from "@/components/Ledger";
import { validateInputs, calculatePosition } from "@/lib/calculations";
import { CalculatorInputs, CalculationResult, AppStatus } from "@/types";
import { getAnonymousId, ensureUser } from "@/lib/user";
import { getTrades } from "@/lib/db/trades";
import type { Trade } from "@/lib/db/trades";

export default function CalculatorClient() {
  // ── Calculator state ──────────────────────────────────────
  const [status,          setStatus]          = useState<AppStatus>("idle");
  const [error,           setError]           = useState<string | null>(null);
  const [result,          setResult]          = useState<CalculationResult | null>(null);
  const [submittedTicker, setSubmittedTicker] = useState<string>("");
  const [totalCapital,    setTotalCapital]    = useState<number>(0);
  const [fetchedAt,       setFetchedAt]       = useState<Date | null>(null);
  const [exchange,        setExchange]        = useState<"NSE" | "BSE">("NSE");

  // ── User + ledger state ───────────────────────────────────
  const [userId, setUserId]   = useState<string | null>(null);
  const [trades, setTrades]   = useState<Trade[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);

  // ── Bootstrap: get/create user and load trades on mount ──
  useEffect(() => {
    async function bootstrap() {
      try {
        const anonymousId = getAnonymousId();         // from localStorage
        const uid         = await ensureUser(anonymousId); // upsert in Supabase
        setUserId(uid);
        await loadTrades(uid);
      } catch (err) {
        console.error("Bootstrap error:", err);
      } finally {
        setLedgerLoading(false);
      }
    }
    bootstrap();
  }, []);

  async function loadTrades(uid: string) {
    try {
      const data = await getTrades(uid);
      setTrades(data);
    } catch (err) {
      console.error("Failed to load trades:", err);
    }
  }

  function refreshTrades() {
    if (userId) loadTrades(userId);
  }

  // ── Calculator ────────────────────────────────────────────
  async function handleCalculate(inputs: CalculatorInputs) {
    setError(null);
    setResult(null);

    const validationError = validateInputs(inputs);
    if (validationError) {
      setError(validationError);
      setStatus("error");
      return;
    }

    setStatus("loading");

    try {
      const res  = await fetch(`/api/search-stocks?ticker=${encodeURIComponent(inputs.ticker)}`);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const body = await res.text();
        throw new Error(
          `API returned non-JSON response (HTTP ${res.status}). ` +
          `This usually means the route failed or returned an HTML error page. ` +
          `Response starts with: ${body.slice(0, 80)}`
        );
      }

      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Failed to fetch price.");

      const calculationResult = calculatePosition(inputs, data.price);
      setResult(calculationResult);
      setSubmittedTicker(data.ticker);
      setTotalCapital(inputs.capital);
      setFetchedAt(new Date());
      setExchange(data.ticker?.endsWith(".BSE") ? "BSE" : "NSE");
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-8">

      {/* ── Calculator row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* Left: Input card */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 shadow-xl">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">
            Trade Parameters
          </h2>
          <CalculatorForm
            onSubmit={handleCalculate}
            isLoading={status === "loading"}
          />
        </section>

        {/* Right: Results card */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 shadow-xl min-h-[200px]">

          {status === "error" && error && (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300 flex gap-2 items-start">
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
              <p className="text-xs text-slate-500 text-center">Edit the form and try again.</p>
            </div>
          )}

          {status === "loading" && (
            <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-slate-500">
              <svg className="animate-spin h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <span className="text-sm">Fetching price…</span>
            </div>
          )}

          {status === "idle" && (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-center">
              <p className="text-sm text-slate-500">
                Results will appear here after you calculate.
              </p>
            </div>
          )}

          {status === "success" && result && (
            <div className="flex flex-col gap-4">
              <ResultsPanel
                result={result}
                ticker={submittedTicker}
                totalCapital={totalCapital}
                fetchedAt={fetchedAt!}
                exchange={exchange}
              />
              <SaveToLedgerButton
                userId={userId}
                ticker={submittedTicker}
                result={result}
                onSaved={refreshTrades}
              />
            </div>
          )}

        </section>
      </div>

      {/* ── Ledger row — full width below calculator ── */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-slate-200">Trade Ledger</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Saved automatically to your browser — no sign-in required.
            </p>
          </div>
          {trades.length > 0 && (
            <span className="text-xs text-slate-500 bg-slate-800 border border-slate-700
              px-2 py-1 rounded-full">
              {trades.filter(t => t.status === "OPEN").length} open
              {" · "}
              {trades.length} total
            </span>
          )}
        </div>

        {ledgerLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-500 text-sm">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Loading ledger…
          </div>
        ) : (
          <Ledger trades={trades} onRefresh={refreshTrades} />
        )}
      </section>

    </div>
  );
}
