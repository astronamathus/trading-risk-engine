"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CalculatorInputs } from "@/types";
import { searchNifty100, NseStock } from "@/lib/nifty100";

// Unified suggestion shape for the dropdown
interface Suggestion {
  symbol:   string;
  name:     string;
  exchange: "NSE" | "BSE";
}

interface CalculatorFormProps {
  onSubmit:  (inputs: CalculatorInputs) => void;
  isLoading: boolean;
}

function Field({ label, hint, children }: {
  label: string; hint?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

// Exported so ResultsPanel can reuse it
export function ExchangeBadge({ exchange }: { exchange: "NSE" | "BSE" }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
      exchange === "NSE"
        ? "border-emerald-600 text-emerald-400 bg-emerald-900/30"
        : "border-amber-600  text-amber-400  bg-amber-900/30"
    }`}>
      {exchange}
    </span>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 " +
  "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 " +
  "focus:border-transparent transition-all text-sm";

export default function CalculatorForm({ onSubmit, isLoading }: CalculatorFormProps) {
  const [ticker,      setTicker]      = useState("");
  const [stopLoss,    setStopLoss]    = useState("");
  const [capital,     setCapital]     = useState("100000");
  const [riskPercent, setRiskPercent] = useState("1");

  // LTP state
  const [ltp,        setLtp]        = useState<number | null>(null);
  const [ltpLoading, setLtpLoading] = useState(false);
  const [ltpError,   setLtpError]   = useState<string | null>(null);

  // Unified suggestion list — NSE entries arrive instantly, BSE appended after 350ms
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [bseLoading,      setBseLoading]      = useState(false);
  const [activeIndex,     setActiveIndex]     = useState(-1);
  const [selectedExchange, setSelectedExchange] = useState<"NSE" | "BSE" | null>(null);

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /**
   * Hybrid search:
   * 1. NSE results from Nifty 100 list — synchronous, instant
   * 2. BSE results from Alpha Vantage API — async, debounced 350ms
   * Both are merged into `suggestions`, NSE first.
   */
  const handleTickerChange = useCallback((val: string) => {
    const upper = val.toUpperCase();
    setTicker(upper);
    setLtp(null);
    setLtpError(null);
    setActiveIndex(-1);
    setSelectedExchange(null);

    if (!upper.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // ── Step 1: NSE results instantly from local list ──
    const nseResults: Suggestion[] = searchNifty100(upper, 5).map(s => ({
      symbol:   `${s.symbol}.NS`,
      name:     s.name,
      exchange: "NSE" as const,
    }));

    setSuggestions(nseResults);
    setShowSuggestions(nseResults.length > 0);

    // ── Step 2: BSE results from Alpha Vantage after 350ms ──
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBseLoading(true);
      try {
        const res  = await fetch(`/api/search-stocks?q=${encodeURIComponent(upper)}`);
        const data = await res.json();

        if (data.results?.length > 0) {
          // Merge: keep current NSE results, append BSE below
          setSuggestions(prev => {
            const bse = (data.results as Suggestion[]).filter(
              r => r.exchange === "BSE"
            );
            // Deduplicate by symbol
            const existing = new Set(prev.map(s => s.symbol));
            const newBse   = bse.filter(s => !existing.has(s.symbol));
            const merged   = [...prev, ...newBse].slice(0, 8);
            if (merged.length > 0) setShowSuggestions(true);
            return merged;
          });
        }
      } catch {
        // BSE search failure is silent — NSE results already shown
      } finally {
        setBseLoading(false);
      }
    }, 350);
  }, []);

  async function fetchLtp(rawTicker: string) {
    if (!rawTicker.trim()) return;
    setLtpLoading(true);
    setLtpError(null);
    setLtp(null);
    try {
      const res  = await fetch(`/api/search-stocks?ticker=${encodeURIComponent(rawTicker)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setLtp(data.price as number);
    } catch (err) {
      setLtpError(err instanceof Error ? err.message : "Could not fetch price.");
    } finally {
      setLtpLoading(false);
    }
  }

  function handleSelect(s: Suggestion) {
    setTicker(s.symbol);
    setSelectedExchange(s.exchange);
    setSuggestions([]);
    setShowSuggestions(false);
    fetchLtp(s.symbol);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  async function handleTickerBlur() {
    await new Promise(r => setTimeout(r, 150));
    setShowSuggestions(false);
    if (!ltp && ticker.trim()) fetchLtp(ticker);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSubmit({
      ticker:      ticker.trim(),
      stopLoss:    parseFloat(stopLoss),
      capital:     parseFloat(capital),
      riskPercent: parseFloat(riskPercent),
    });
  }

  const tickerHint: React.ReactNode = ltpLoading ? (
    <span className="text-blue-400">Fetching price…</span>
  ) : ltpError ? (
    <span className="text-red-400">{ltpError}</span>
  ) : ltp ? (
    <span className="flex items-center gap-1.5">
      {selectedExchange && <ExchangeBadge exchange={selectedExchange} />}
      <span className="text-emerald-400">
        LTP: ₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </span>
  ) : (
    "Type a company name or symbol — NSE results appear instantly"
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      <Field label="Stock Ticker" hint={tickerHint}>
        <div ref={wrapperRef} className="relative">
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. RELIANCE or Tata Consultancy"
            value={ticker}
            onChange={e => handleTickerChange(e.target.value)}
            onBlur={handleTickerBlur}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoComplete="off"
            required
          />

          {/* BSE loading indicator — subtle dot in corner */}
          {bseLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2"
              title="Loading BSE results…">
              <svg className="animate-spin h-3.5 w-3.5 text-amber-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            </div>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border
              border-slate-600 bg-slate-900 shadow-xl overflow-hidden">

              {suggestions.map((s, i) => (
                <li
                  key={s.symbol}
                  onMouseDown={() => handleSelect(s)}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer
                    transition-colors text-sm ${
                    i === activeIndex
                      ? "bg-blue-600 text-white"
                      : "text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-mono font-semibold">{s.symbol}</span>
                    <span className={`text-xs ${i === activeIndex ? "text-blue-200" : "text-slate-500"}`}>
                      {s.name}
                    </span>
                  </div>
                  <ExchangeBadge exchange={s.exchange} />
                </li>
              ))}

              {/* BSE loading row at the bottom */}
              {bseLoading && (
                <li className="flex items-center gap-2 px-3 py-2 text-xs text-amber-400/70 border-t border-slate-800">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Loading BSE results…
                </li>
              )}
            </ul>
          )}
        </div>
      </Field>

      <Field
        label="Stop Loss (₹)"
        hint="The price at which you'll cut your loss and exit the trade if it moves against you."
      >
        <input
          type="number"
          className={inputClass}
          placeholder="e.g. 2300"
          value={stopLoss}
          onChange={e => setStopLoss(e.target.value)}
          disabled={isLoading}
          min="0.01" step="0.01"
          required
        />
      </Field>

      <Field label="Total Capital (₹)" hint="Your total trading account size">
        <input
          type="number"
          className={inputClass}
          placeholder="e.g. 100000"
          value={capital}
          onChange={e => setCapital(e.target.value)}
          disabled={isLoading}
          min="1" step="1"
          required
        />
      </Field>

      <Field label="Risk Percentage (%)" hint="Recommended: 1–2% per trade. Professionals use ≤1%.">
        <div className="relative">
          <input
            type="number"
            className={inputClass + " pr-8"}
            placeholder="e.g. 1"
            value={riskPercent}
            onChange={e => setRiskPercent(e.target.value)}
            disabled={isLoading}
            min="0.1" max="100" step="0.1"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
            %
          </span>
        </div>
      </Field>

      <button
        type="submit"
        disabled={isLoading || ltpLoading}
        className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
          text-white transition-all hover:bg-blue-500 active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Calculating…
          </span>
        ) : "Calculate Position"}
      </button>

    </form>
  );
}