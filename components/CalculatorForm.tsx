"use client";

import { useState } from "react";
import { CalculatorInputs } from "@/types";

interface CalculatorFormProps {
  onSubmit: (inputs: CalculatorInputs) => void;
  isLoading: boolean;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 " +
  "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 " +
  "focus:border-transparent transition-all text-sm";

export default function CalculatorForm({ onSubmit, isLoading }: CalculatorFormProps) {
  const [ticker, setTicker]           = useState("");
  const [stopLoss, setStopLoss]       = useState("");
  const [capital, setCapital]         = useState("100000");
  const [riskPercent, setRiskPercent] = useState("1");

  // LTP state — fetched when ticker loses focus
  const [ltp, setLtp]               = useState<number | null>(null);
  const [ltpLoading, setLtpLoading] = useState(false);
  const [ltpError, setLtpError]     = useState<string | null>(null);

  // Fetch LTP and auto-populate stop loss when user leaves the ticker field
  async function handleTickerBlur() {
    const t = ticker.trim();
    if (!t) return;

    setLtpLoading(true);
    setLtpError(null);
    setLtp(null);

    try {
      const res  = await fetch(`/api/stock-price?ticker=${encodeURIComponent(t)}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      const price = data.price as number;
      setLtp(price);

      // Auto-set stop loss to 2% below LTP (only if user hasn't typed one)
      const autoStop = parseFloat((price * 0.98).toFixed(2));
      setStopLoss(String(autoStop));
    } catch (err) {
      setLtpError(err instanceof Error ? err.message : "Could not fetch price.");
    } finally {
      setLtpLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    onSubmit({
      ticker:     ticker.trim(),
      stopLoss:   parseFloat(stopLoss),
      capital:    parseFloat(capital),
      riskPercent: parseFloat(riskPercent),
    });
  }

  // Build the hint line shown below the ticker input
  const tickerHint: React.ReactNode = ltpLoading ? (
    <span className="text-blue-400">Fetching price…</span>
  ) : ltpError ? (
    <span className="text-red-400">{ltpError}</span>
  ) : ltp ? (
    <span className="text-emerald-400">
      LTP: ₹{ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      {" · "}Stop loss auto-set to 2% below LTP
    </span>
  ) : (
    "e.g. RELIANCE, TCS, INFY — tab out after typing to fetch price"
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      <Field label="Stock Ticker" hint={tickerHint}>
        <input
          type="text"
          className={inputClass}
          placeholder="e.g. RELIANCE"
          value={ticker}
          onChange={(e) => { setTicker(e.target.value.toUpperCase()); setLtp(null); }}
          onBlur={handleTickerBlur}
          disabled={isLoading}
          required
        />
      </Field>

      <Field
        label="Stop Loss (₹)"
        hint="Auto-set to 2% below LTP — you can override this"
      >
        <input
          type="number"
          className={inputClass}
          placeholder="e.g. 2300"
          value={stopLoss}
          onChange={(e) => setStopLoss(e.target.value)}
          disabled={isLoading}
          min="0.01"
          step="0.01"
          required
        />
      </Field>

      <Field label="Total Capital (₹)" hint="Your total trading account size">
        <input
          type="number"
          className={inputClass}
          placeholder="e.g. 100000"
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
          disabled={isLoading}
          min="1"
          step="1"
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
            onChange={(e) => setRiskPercent(e.target.value)}
            disabled={isLoading}
            min="0.1"
            max="100"
            step="0.1"
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
        className="
          mt-2 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold
          text-white transition-all hover:bg-blue-500 active:scale-[0.98]
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-400
        "
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Calculating…
          </span>
        ) : "Calculate Position"}
      </button>

    </form>
  );
}