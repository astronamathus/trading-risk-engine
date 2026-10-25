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
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { formatMoney, marketFromTicker } from "@/lib/currency";

export default function CalculatorClient() {
  const [status,          setStatus]          = useState<AppStatus>("idle");
  const [error,           setError]           = useState<string | null>(null);
  const [result,          setResult]          = useState<CalculationResult | null>(null);
  const [submittedTicker, setSubmittedTicker] = useState<string>("");
  const [totalCapital,    setTotalCapital]    = useState<number>(0);
  const [fetchedAt,       setFetchedAt]       = useState<Date | null>(null);
  const [exchange,        setExchange]        = useState<"NSE" | "BSE" | "NYSE" | "NASDAQ">("NSE");
  const [market, setMarket] = useState<"INR" | "USD">("INR");
  const [capitalPools, setCapitalPools] = useState<{ INR: number; USD: number }>({ INR: 100000, USD: 10000 });
  const [displayedQty,       setDisplayedQty]       = useState<number>(0);
  const [displayedRisk,      setDisplayedRisk]       = useState<number>(0);
  const [displayedCapReq,    setDisplayedCapReq]     = useState<number>(0);
  const [isQueued,           setIsQueued]            = useState(false);
  const [livePriceAtCalc,    setLivePriceAtCalc]     = useState<number>(0);
  const [availableCapital,   setAvailableCapital]    = useState<number | null>(null);

  const { user } = useAuth();
  const userId   = user?.id ?? null;

  // Fetch capital limit and currently deployed capital (open trades cost)
  // so we know how much is genuinely available before allowing a save.
  useEffect(() => {
    if (!userId) return;
    async function fetchAvailable() {
      const [userRow, tradesRow] = await Promise.all([
        supabase.from("trader_users").select("capital_limit, capital_limit_usd").eq("id", userId).single(),
        supabase.from("trades")
          .select("entry_price, quantity, currency, status")
          .eq("user_id", userId)
          .eq("status", "OPEN")
          .is("deleted_at", null),
      ]);
      const trades = tradesRow.data ?? [];
      const pools = { INR: userRow.data?.capital_limit ?? 100000, USD: userRow.data?.capital_limit_usd ?? 10000 };
      setCapitalPools(pools);
      const limit = pools[market];
      const deployed = trades.filter((t: any) => (t.currency ?? "INR") === market && t.status === "OPEN")
        .reduce((sum: number, t: any) => sum + t.entry_price * t.quantity, 0);
      setAvailableCapital(limit - deployed);
    }
    fetchAvailable();
  }, [userId, market]);

  async function handleCalculate(inputs: CalculatorInputs & { entryPrice: number }) {
    setError(null);
    setResult(null);

    const validationError = validateInputs(inputs);
    if (validationError) { setError(validationError); setStatus("error"); return; }

    setStatus("loading");
    try {
      const res = await fetch(`/api/search-stocks?ticker=${encodeURIComponent(inputs.ticker)}`);
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const body = await res.text();
        throw new Error(`API returned non-JSON (HTTP ${res.status}). Starts: ${body.slice(0, 80)}`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to fetch price.");

      const livePrice  = data.price as number;
      const currency = (data.market ?? inputs.market ?? marketFromTicker(inputs.ticker)) as "INR" | "USD";
      setMarket(currency);
      const entryPrice = inputs.entryPrice;
      const queued     = entryPrice > livePrice;

      const slError = validateStopLoss(inputs.stopLoss, entryPrice, inputs.capital, inputs.riskPercent);
      if (slError) throw new Error(slError);

      const calculationResult = calculatePosition(inputs, entryPrice);
      setResult(calculationResult);
      setSubmittedTicker(data.ticker);
      setTotalCapital(inputs.capital);
      setFetchedAt(new Date());
      setExchange(inputs.exchange ?? data.exchange ?? (currency === "INR" ? (data.ticker?.endsWith(".BO") ? "BSE" : "NSE") : "NYSE"));
      setIsQueued(queued);
      setLivePriceAtCalc(livePrice);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  const cardClass =
    "rounded-2xl border border-slate-200 dark:border-slate-700 " +
    "bg-white dark:bg-slate-800/50 backdrop-blur p-6 shadow-sm dark:shadow-xl";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

      {/* Left: Input card */}
      <section className={cardClass}>
        <CalculatorForm onSubmit={handleCalculate} isLoading={status === "loading"} capitalPools={capitalPools}/>
      </section>

      {/* Right: Results card */}
      <section className={`${cardClass} min-h-[200px]`}>

        {status === "error" && error && (
          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-red-300 dark:border-red-700
              bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm
              text-red-700 dark:text-red-300 flex gap-2 items-start">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
              Edit the form and try again.
            </p>
          </div>
        )}

        {status === "loading" && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-12
            text-slate-400 dark:text-slate-500">
            <svg className="animate-spin h-6 w-6 text-blue-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-sm">Fetching price…</span>
          </div>
        )}

        {status === "idle" && (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Results will appear here after you calculate.
            </p>
          </div>
        )}

        {status === "success" && result && (
          <div className="flex flex-col gap-4">
            {isQueued && (
              <div className="rounded-xl border border-amber-300 dark:border-amber-700
                bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm
                text-amber-700 dark:text-amber-300 flex gap-2 items-start">
                <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6.5"/>
                  <path d="M8 4.5V8l2.5 2"/>
                </svg>
                <span>
                  Entry {formatMoney(result.entryPrice, market)} is above LTP {formatMoney(livePriceAtCalc, market)}.
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
              onDisplayChange={(qty, risk, capReq) => { setDisplayedQty(qty); setDisplayedRisk(risk); setDisplayedCapReq(capReq); }}
            />
            <SaveToLedgerButton
              userId={userId}
              ticker={submittedTicker}
              result={result}
              displayedQty={displayedQty}
              displayedRisk={displayedRisk}
              displayedCapReq={displayedCapReq}
              availableCapital={availableCapital}
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