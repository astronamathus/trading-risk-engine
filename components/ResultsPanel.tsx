"use client";

import { useState, useEffect, useRef } from "react";
import { CalculationResult } from "@/types";
import { recalculateWithCapitalLimit } from "@/lib/calculations";

interface ResultsPanelProps {
  result:       CalculationResult;
  ticker:       string;
  totalCapital: number;
  fetchedAt:    Date;  // used as reset signal — must be passed from CalculatorClient
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(v);
}

function Tile({ label, value, sub, highlight = false, warn = false, tooltip }: {
  label: string; value: string; sub?: React.ReactNode;
  highlight?: boolean; warn?: boolean; tooltip?: string;
}) {
  return (
    <div title={tooltip} className={`rounded-xl border p-4 flex flex-col gap-1 transition-colors ${
      highlight
        ? "border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30"
        : warn
          ? "border-red-700 bg-red-950/30"
          : "border-slate-700 bg-slate-800/60"
    }`}>
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-xl font-bold ${
        highlight ? "text-blue-300" : warn ? "text-red-400" : "text-slate-100"
      }`}>{value}</span>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

const PRESETS = [
  { label: "5%",   pct: 0.05 },
  { label: "10%",  pct: 0.10 },
  { label: "25%",  pct: 0.25 },
  { label: "50%",  pct: 0.50 },
  { label: "100%", pct: 1.00 },
];

type CapitalMode = "auto" | "limit";

export default function ResultsPanel({ result, ticker, totalCapital, fetchedAt }: ResultsPanelProps) {
  const { entryPrice, riskPerShare, maxRiskAmount } = result;

  const defaultLimit = Math.round(totalCapital * 0.10);
<<<<<<< HEAD
=======

  // ── NEW: mode state ─────────────────────────────────────────
>>>>>>> ab22286 (Fixed auto mode bug)
  const [mode, setMode]                 = useState<CapitalMode>("limit");
  const [limitValue, setLimitValue]     = useState(defaultLimit);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef                     = useRef<HTMLDivElement>(null);

  // Reset when a NEW calculation is submitted.
  // We depend on fetchedAt (a new Date() per submission) — NOT on
  // `result` or `totalCapital`, which cause re-renders and would
  // instantly flip Auto back to limit every time you click it.
  useEffect(() => {
    setLimitValue(Math.round(totalCapital * 0.10));
    setMode("limit");
  }, [fetchedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── NEW: display switches on mode ───────────────────────────
  // Auto  → sized by risk rule (capital × risk% ÷ risk/share)
  // Limit → sized by how much capital you deploy
  const display = mode === "auto"
    ? {
        positionSize:    result.positionSize,
        actualRisk:      parseFloat((riskPerShare * result.positionSize).toFixed(2)),
        capitalRequired: parseFloat((result.positionSize * entryPrice).toFixed(2)),
      }
    : recalculateWithCapitalLimit(limitValue, entryPrice, riskPerShare);

  const riskExceedsMax = display.actualRisk > maxRiskAmount;

  const fetchTime = fetchedAt.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const pctOfCapital = (limitValue / totalCapital) * 100;

<<<<<<< HEAD
  const activePreset = mode === "auto"
    ? null
    : PRESETS.find(p => Math.round(totalCapital * p.pct) === limitValue) ?? null;

=======
  const activePreset = mode === "limit"
    ? PRESETS.find(p => Math.round(totalCapital * p.pct) === limitValue) ?? null
    : null;

  // Trigger label: "Auto", preset label, or custom %
>>>>>>> ab22286 (Fixed auto mode bug)
  const triggerLabel = mode === "auto"
    ? "Auto"
    : activePreset
      ? activePreset.label
      : `${pctOfCapital.toFixed(1)}%`;

  function applyPreset(pct: number) {
    setMode("limit");
    setLimitValue(pct === 1 ? totalCapital : Math.round(totalCapital * pct));
    setDropdownOpen(false);
  }

  function handleSliderChange(raw: number) {
    const val = raw >= totalCapital - 500 ? totalCapital : raw;
    setLimitValue(val);
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">
          <span className="text-blue-400 font-mono">{ticker.toUpperCase()}</span>
        </h2>
        <span className="text-xs text-slate-600" title="Time price was last fetched">
          fetched {fetchTime}
        </span>
      </div>

      {/* Row 1: Entry Price | Risk Per Share */}
      <div className="grid grid-cols-2 gap-3">
        <Tile label="Entry Price"    value={formatINR(entryPrice)}   tooltip="Current market price fetched live" />
        <Tile label="Risk Per Share" value={formatINR(riskPerShare)}  tooltip="Entry Price − Stop Loss" />
      </div>

      {/* Row 2: Position Size | Risk Amount */}
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Position Size"
          value={`${display.positionSize.toLocaleString("en-IN")} shares`}
          highlight
          tooltip="Shares you can buy within your capital limit"
        />

        <div className={`rounded-xl border p-4 flex flex-col gap-1 transition-colors ${
          riskExceedsMax ? "border-red-700 bg-red-950/30" : "border-slate-700 bg-slate-800/60"
        }`}>
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Risk Amount</span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={`text-xl font-bold ${riskExceedsMax ? "text-red-400" : "text-slate-100"}`}>
              {formatINR(display.actualRisk)}
            </span>
            <span className="text-sm text-slate-500">/ {formatINR(maxRiskAmount)}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-slate-500">actual / max</span>
            {riskExceedsMax && (
              <span className="text-xs text-red-400 font-medium">· exceeds limit</span>
            )}
          </div>
        </div>
      </div>

      {/* Capital Required with dropdown */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-3">

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Capital Required
          </span>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-600
                bg-slate-700/60 px-3 py-1.5 text-xs font-medium text-slate-200
                hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg className="w-3 h-3 text-slate-400" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="4" r="1.5" fill="currentColor"/>
                <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
                <circle cx="8" cy="12" r="1.5" fill="currentColor"/>
              </svg>
              {mode === "auto" ? "Auto" : `Limit: ${triggerLabel}`}
              <svg className={`w-3 h-3 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 16 16" fill="none">
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-slate-600
                bg-slate-900 shadow-2xl shadow-black/40 p-3 flex flex-col gap-3">

                {/* ── NEW: Auto option ── */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Mode</p>
                  <button
                    onClick={() => { setMode("auto"); setDropdownOpen(false); }}
<<<<<<< HEAD
                    className={`w-full rounded-lg py-1.5 px-3 text-xs font-medium text-left
                      transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                      flex items-center justify-between
=======
                    className={`w-full flex items-center justify-between rounded-lg px-3 py-2
                      text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
>>>>>>> ab22286 (Fixed auto mode bug)
                      ${mode === "auto"
                        ? "bg-blue-600 text-white border border-blue-500"
                        : "border border-slate-600 text-slate-300 hover:bg-slate-700"
                      }`}
                  >
                    <span>Auto</span>
<<<<<<< HEAD
                    <span className={`text-xs ${mode === "auto" ? "text-blue-200" : "text-slate-500"}`}>
=======
                    <span className={`${mode === "auto" ? "text-blue-200" : "text-slate-500"}`}>
>>>>>>> ab22286 (Fixed auto mode bug)
                      sized by risk rule
                    </span>
                  </button>
                </div>

                <div className="border-t border-slate-700" />

<<<<<<< HEAD
                <div>
                  <p className="text-xs text-slate-500 mb-2">Capital limit presets</p>
=======
                {/* Presets — clicking any switches back to limit mode */}
                <div>
                  <p className="text-xs text-slate-500 mb-2">Capital limit</p>
>>>>>>> ab22286 (Fixed auto mode bug)
                  <div className="grid grid-cols-5 gap-1.5">
                    {PRESETS.map(p => {
                      const isActive = mode === "limit" && activePreset?.label === p.label;
                      return (
                        <button
                          key={p.label}
                          onClick={() => applyPreset(p.pct)}
                          className={`rounded-lg py-1.5 text-xs font-medium transition-colors
                            focus:outline-none focus:ring-2 focus:ring-blue-500
                            ${isActive
                              ? "bg-blue-600 text-white border border-blue-500"
                              : "border border-slate-600 text-slate-300 hover:bg-slate-700"
                            }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-slate-700" />

                {/* Custom input + slider — always visible, clicking activates limit mode */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500">Custom limit</p>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-600
                    bg-slate-800 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500
                    focus-within:border-transparent transition-all">
                    <span className="text-sm text-slate-400 select-none">₹</span>
                    <input
                      type="number"
                      value={limitValue}
                      min={Math.ceil(entryPrice)}
                      max={totalCapital}
                      step={500}
                      onChange={e => {
                        setMode("limit");
                        const v = parseFloat(e.target.value) || 0;
                        setLimitValue(Math.max(Math.ceil(entryPrice), Math.min(totalCapital, v)));
                      }}
                      className="flex-1 bg-transparent text-sm text-slate-100 focus:outline-none min-w-0"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {pctOfCapital.toFixed(1)}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={Math.ceil(entryPrice)}
                    max={totalCapital}
                    step={500}
                    value={mode === "auto" ? totalCapital : limitValue}
                    onChange={e => {
                      setMode("limit");
                      handleSliderChange(parseFloat(e.target.value));
                    }}
                    className="w-full accent-blue-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>₹{Math.ceil(entryPrice).toLocaleString("en-IN")}</span>
                    <span>₹{totalCapital.toLocaleString("en-IN")}</span>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

        <span className="text-2xl font-bold text-slate-100">
          {formatINR(display.capitalRequired)}
        </span>

        <span className="text-xs text-slate-500 italic">
          {mode === "auto"
<<<<<<< HEAD
            ? "Sized purely by your risk rule (capital × risk% ÷ risk per share)"
=======
            ? "Sized by risk rule — capital × risk% ÷ risk per share"
>>>>>>> ab22286 (Fixed auto mode bug)
            : limitValue === totalCapital
              ? "Using full capital for this position"
              : `Capped at ${formatINR(limitValue)} (${pctOfCapital.toFixed(1)}% of capital)`}
        </span>

      </div>
    </div>
  );
}