// ============================================================
// components/CalculatorClient.tsx
// Client component for the trading calculator
// ============================================================


"use client";

import { useState, useEffect } from "react";
import CalculatorForm     from "@/components/CalculatorForm";
import ResultsPanel       from "@/components/ResultsPanel";
import SaveToLedgerButton from "@/components/SaveToLedgerButton";
import { validateInputs, calculatePosition, validateStopLoss } from "@/lib/calculations";
import { CalculatorInputs, CalculationResult, AppStatus } from "@/types";
import { getAnonymousId, ensureUser } from "@/lib/user";

//Main client component
export default function CalculatorClient() {
  const [status,           setStatus]           = useState<AppStatus>("idle");
  const [error,            setError]            = useState<string | null>(null);
  const [result,           setResult]           = useState<CalculationResult | null>(null);
  const [submittedTicker,  setSubmittedTicker]  = useState<string>("");
  const [totalCapital,     setTotalCapital]     = useState<number>(0);
  const [fetchedAt,        setFetchedAt]        = useState<Date | null>(null);
  const [exchange,         setExchange]         = useState<"NSE" | "BSE">("NSE");
  const [displayedQty,     setDisplayedQty]     = useState<number>(0);
  const [displayedRisk,    setDisplayedRisk]    = useState<number>(0);

  // Track whether this is a queued trade (entry > LTP)
  const [isQueued,         setIsQueued]         = useState(false);
  const [livePriceAtCalc,  setLivePriceAtCalc]  = useState<number>(0);

  const [userId, setUserId] = useState<string | null>(null);
//Assign unique ID for each new session
  useEffect(() => {
    async function bootstrap() {
      try {
        const anonymousId = getAnonymousId();
        const uid         = await ensureUser(anonymousId);
        setUserId(uid);
      } catch (err) {
        console.error("User bootstrap error:", err);
      }
    }
    bootstrap();
  }, []);

  async function handleCalculate(inputs: CalculatorInputs & { entryPrice: number }) {
    setError(null);
    setResult(null);

//Validate errors
    const validationError = validateInputs(inputs);
    if (validationError) {
      setError(validationError);
      setStatus("error");
      return;
    }
    //Loading status
    setStatus("loading");

    try {
      // Always fetch live price for validation + queued detection
      const res = await fetch(
        `/api/search-stocks?ticker=${encodeURIComponent(inputs.ticker)}`
      );
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const body = await res.text();
        throw new Error(`API returned non-JSON (HTTP ${res.status}). Starts: ${body.slice(0, 80)}`);
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch price.");

      const livePrice   = data.price as number;
      const entryPrice  = inputs.entryPrice; // user's intended entry
      const queued      = entryPrice > livePrice;

      // Validate stop loss against the user's entry price (not necessarily live)
      const slError = validateStopLoss(
        inputs.stopLoss,
        entryPrice,
        inputs.capital,
        inputs.riskPercent
      );
      if (slError) throw new Error(slError);

      // Calculate using user's entry price
      const calculationResult = calculatePosition(inputs, entryPrice);

      setResult(calculationResult);
      setSubmittedTicker(data.ticker);
      setTotalCapital(inputs.capital);
      setFetchedAt(new Date());
      setExchange(data.ticker?.endsWith(".BO") ? "BSE" : "NSE");
      setIsQueued(queued);
      setLivePriceAtCalc(livePrice);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

      {/* Left: Input card */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 shadow-xl">
        <CalculatorForm
          onSubmit={handleCalculate}
          isLoading={status === "loading"}
        />
      </section>

      {/* Right: Results card */}
      <section className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur p-6 shadow-xl min-h-[200px]">

        {status === "error" && error && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
              text-sm text-red-300 flex gap-2 items-start">
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
            <span className="text-3xl opacity-20">📋</span>
            <p className="text-sm text-slate-500">
              Results will appear here after you calculate.
            </p>
          </div>
        )}

        {status === "success" && result && (
          <div className="flex flex-col gap-4">
            {/* Queued banner */}
            {isQueued && (
              <div className="rounded-xl border border-amber-700 bg-amber-900/20 px-4 py-3
                text-sm text-amber-300 flex gap-2 items-start">
                <span className="mt-0.5">🕐</span>
                <span>
                  Entry ₹{result.entryPrice.toLocaleString("en-IN")} is above LTP ₹{livePriceAtCalc.toLocaleString("en-IN")}.
                  This trade will be <strong>queued</strong> and activate automatically when price is reached.
                </span>
              </div>
            )}

            <ResultsPanel
              result={result}
              ticker={submittedTicker}
              totalCapital={totalCapital}
              fetchedAt={fetchedAt!}
              exchange={exchange}
              onDisplayChange={(qty, risk) => {
                setDisplayedQty(qty);
                setDisplayedRisk(risk);
              }}
            />
            <SaveToLedgerButton
              userId={userId}
              ticker={submittedTicker}
              result={result}
              displayedQty={displayedQty}
              displayedRisk={displayedRisk}
              totalCapital={totalCapital}
              isQueued={isQueued}
              onSaved={() => {}}
            />
          </div>
        )}

      </section>
    </div>
  );
}