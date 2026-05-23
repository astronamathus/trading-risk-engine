"use client";

import { useState } from "react";
import CalculatorForm from "@/components/CalculatorForm";
import ResultsPanel from "@/components/ResultsPanel";
import { validateInputs, calculatePosition } from "@/lib/calculations";
import { CalculatorInputs, CalculationResult, AppStatus } from "@/types";

export default function CalculatorClient() {
  const [status, setStatus]                 = useState<AppStatus>("idle");
  const [error, setError]                   = useState<string | null>(null);
  const [result, setResult]                 = useState<CalculationResult | null>(null);
  const [submittedTicker, setSubmittedTicker] = useState<string>("");
  const [totalCapital, setTotalCapital]       = useState<number>(0);
  const [fetchedAt, setFetchedAt]             = useState<Date | null>(null);
  const [exchange, setExchange]               = useState<"NSE" | "BSE">("NSE"); // timestamp

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
      const data = await res.json();

      if (!data.success) throw new Error(data.error || "Failed to fetch price.");

      const calculationResult = calculatePosition(inputs, data.price);

      setResult(calculationResult);
      setSubmittedTicker(data.ticker);
      setTotalCapital(inputs.capital);
      setFetchedAt(new Date());
      // Detect exchange from the ticker suffix returned by the API
      setExchange(data.ticker?.endsWith(".BSE") ? "BSE" : "NSE"); // record the moment price was fetched
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    // Side-by-side on md+ screens, stacked on mobile
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

      {/* Right: Results card — always rendered, shows placeholder when idle */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 shadow-xl min-h-[200px]">

        {/* Error state — shown alongside idle placeholder so form stays usable */}
        {status === "error" && error && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3 text-sm text-red-300 flex gap-2 items-start">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
            <p className="text-xs text-slate-500 text-center">
              Edit the form and try again.
            </p>
          </div>
        )}

        {/* Loading state */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12 text-slate-500">
            <svg className="animate-spin h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm">Fetching price…</span>
          </div>
        )}

        {/* Idle placeholder */}
        {status === "idle" && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-center">
            <span className="text-3xl opacity-20">📋</span>
            <p className="text-sm text-slate-500">
              Results will appear here after you calculate.
            </p>
          </div>
        )}

        {/* Success: results */}
        {status === "success" && result && (
          <ResultsPanel
            result={result}
            ticker={submittedTicker}
            totalCapital={totalCapital}
            fetchedAt={fetchedAt!}
            exchange={exchange}
          />
        )}

      </section>

    </div>
  );
}