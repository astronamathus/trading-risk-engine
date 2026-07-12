"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CalculatorInputs } from "@/types";
import { searchStocks } from "@/lib/stockList";

interface Suggestion {
  symbol:   string;
  name:     string;
  exchange: "NSE" | "BSE";
}

interface CalculatorFormProps {
  onSubmit:  (inputs: CalculatorInputs & { entryPrice: number }) => void;
  isLoading: boolean;
}

function Field({ label, hint, children }: {
  label: string; hint?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500 dark:text-slate-500">{hint}</p>}
    </div>
  );
}

export function ExchangeBadge({ exchange }: { exchange: "NSE" | "BSE" }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
      exchange === "NSE"
        ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
        : "border-amber-500  text-amber-600  dark:text-amber-400  bg-amber-50  dark:bg-amber-900/30"
    }`}>
      {exchange}
    </span>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
    </svg>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 dark:border-slate-600 " +
  "bg-white dark:bg-slate-800 px-3 py-2 " +
  "text-slate-900 dark:text-slate-100 " +
  "placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent " +
  "transition-all text-sm";

export default function CalculatorForm({ onSubmit, isLoading }: CalculatorFormProps) {
  const [ticker,      setTicker]      = useState("");
  const [entryPrice,  setEntryPrice]  = useState("");
  const [stopLoss,    setStopLoss]    = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [capital,      setCapital]      = useState("100000");
  const [riskPercent,  setRiskPercent]  = useState("1");
  const [ltp,        setLtp]        = useState<number | null>(null);
  const [ltpLoading, setLtpLoading] = useState(false);
  const [ltpError,   setLtpError]   = useState<string | null>(null);
  const [suggestions,     setSuggestions]     = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex,     setActiveIndex]     = useState(-1);
  const [selectedExchange, setSelectedExchange] = useState<"NSE" | "BSE" | null>(null);

  const wrapperRef  = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node))
        setShowSettings(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleTickerChange = useCallback((val: string) => {
    const upper = val.toUpperCase();
    setTicker(upper);
    setLtp(null); setLtpError(null); setActiveIndex(-1);
    setSelectedExchange(null); setEntryPrice("");
    if (!upper.trim()) { setSuggestions([]); setShowSuggestions(false); return; }
    const results: Suggestion[] = searchStocks(upper, 8).map(s => ({
      symbol: `${s.symbol}.${s.exchange === "NSE" ? "NS" : "BO"}`,
      name:   s.name,
      exchange: s.exchange,
    }));
    setSuggestions(results);
    setShowSuggestions(results.length > 0);
  }, []);

  async function fetchLtp(rawTicker: string) {
    if (!rawTicker.trim()) return;
    setLtpLoading(true); setLtpError(null); setLtp(null);
    try {
      const res  = await fetch(`/api/search-stocks?ticker=${encodeURIComponent(rawTicker)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const price = data.price as number;
      setLtp(price);
      setEntryPrice(price.toFixed(2));
    } catch (err) {
      setLtpError(err instanceof Error ? err.message : "Could not fetch price.");
    } finally {
      setLtpLoading(false);
    }
  }

  function handleSelect(s: Suggestion) {
    setTicker(s.symbol); setSelectedExchange(s.exchange);
    setSuggestions([]); setShowSuggestions(false);
    fetchLtp(s.symbol);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIndex >= 0) { e.preventDefault(); handleSelect(suggestions[activeIndex]); }
    else if (e.key === "Escape") setShowSuggestions(false);
  }

  async function handleTickerBlur() {
    await new Promise(r => setTimeout(r, 150));
    setShowSuggestions(false);
    if (!ltp && ticker.trim()) fetchLtp(ticker);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); e.stopPropagation();
    onSubmit({
      ticker: ticker.trim(), stopLoss: parseFloat(stopLoss),
      capital: parseFloat(capital), riskPercent: parseFloat(riskPercent),
      entryPrice: parseFloat(entryPrice),
    });
  }

  const entryNum = parseFloat(entryPrice);
  const entryHint: React.ReactNode = ltp && entryNum && !isNaN(entryNum) ? (
    entryNum > ltp ? (
      <span className="text-amber-600 dark:text-amber-400">
        ↑ Above LTP — trade will be <strong>queued</strong> until price reaches ₹{entryNum.toLocaleString("en-IN")}
      </span>
    ) : entryNum < ltp ? (
      <span className="text-blue-600 dark:text-blue-400">↓ Below LTP — entry is immediate</span>
    ) : <span className="text-slate-400">At LTP</span>
  ) : null;

  const tickerHint: React.ReactNode = ltpLoading ? (
    <span className="text-blue-600 dark:text-blue-400">Fetching price…</span>
  ) : ltpError ? (
    <span className="text-red-600 dark:text-red-400">{ltpError}</span>
  ) : ltp ? (
    <span className="flex items-center gap-1.5">
      {selectedExchange && <ExchangeBadge exchange={selectedExchange}/>}
      <span className="text-emerald-600 dark:text-emerald-400">
        LTP: ₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </span>
  ) : "Type symbol or company name — add .NS for NSE, .BO for BSE";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Trade Parameters
        </span>
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setShowSettings(s => !s)}
            className={`p-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              showSettings
                ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
            title="Risk settings"
          >
            <SettingsIcon/>
          </button>

          {showSettings && (
            <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border
              border-slate-200 dark:border-slate-600
              bg-white dark:bg-slate-900 shadow-xl p-4 flex flex-col gap-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Risk Settings
              </p>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Total Capital (₹)</label>
                <input type="number" value={capital} onChange={e => setCapital(e.target.value)}
                  className={inputClass} placeholder="e.g. 100000" min="1" step="1000"/>
                <p className="text-xs text-slate-400 dark:text-slate-600">Your total trading account size</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">Risk Percentage (%)</label>
                <div className="relative">
                  <input type="number" value={riskPercent} onChange={e => setRiskPercent(e.target.value)}
                    className={inputClass + " pr-8"} placeholder="e.g. 1" min="0.1" max="100" step="0.1"/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">%</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-600">Max % of capital to risk per trade</p>
              </div>
              <button type="button" onClick={() => setShowSettings(false)}
                className="w-full rounded-lg bg-slate-100 dark:bg-slate-700 px-3 py-1.5 text-xs
                  font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ticker */}
      <Field label="Stock Ticker" hint={tickerHint}>
        <div ref={wrapperRef} className="relative">
          <input type="text" className={inputClass}
            placeholder="e.g. RELIANCE or Tata Consultancy"
            value={ticker} onChange={e => handleTickerChange(e.target.value)}
            onBlur={handleTickerBlur}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            onKeyDown={handleKeyDown} disabled={isLoading}
            autoComplete="off" required/>
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 top-full mt-1 rounded-xl border
              border-slate-200 dark:border-slate-600
              bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
              {suggestions.map((s, i) => (
                <li key={`${s.symbol}-${s.exchange}-${i}`}
                  onMouseDown={() => handleSelect(s)}
                  className={`flex items-center justify-between px-3 py-2.5 cursor-pointer
                    transition-colors text-sm ${
                    i === activeIndex
                      ? "bg-blue-600 text-white"
                      : "text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}>
                  <div className="flex flex-col">
                    <span className="font-mono font-semibold">{s.symbol}</span>
                    <span className={`text-xs ${i === activeIndex ? "text-blue-200" : "text-slate-500"}`}>
                      {s.name}
                    </span>
                  </div>
                  <ExchangeBadge exchange={s.exchange}/>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>

      {/* Entry Price */}
      <Field label="Entry Price (₹)" hint={entryHint ?? "Auto-filled from LTP — edit to queue at a different price"}>
        <input type="number" className={inputClass} placeholder="e.g. 2300"
          value={entryPrice} onChange={e => setEntryPrice(e.target.value)}
          disabled={isLoading} min="0.01" step="0.01" required/>
      </Field>

      {/* Stop Loss */}
      <Field label="Stop Loss (₹)" hint="Price at which you'll exit if the trade moves against you">
        <input type="number" className={inputClass} placeholder="e.g. 2200"
          value={stopLoss} onChange={e => setStopLoss(e.target.value)}
          disabled={isLoading} min="0.01" step="0.01" required/>
      </Field>

      <button type="submit" disabled={isLoading || ltpLoading}
        className="mt-1 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
          text-white transition-all hover:bg-blue-500 active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-400">
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