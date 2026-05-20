"use client";

import { useState, useEffect } from "react";
import { CalculationResult } from "@/types";
import { recalculateWithCapitalLimit } from "@/lib/calculations";

interface ResultsPanelProps {
  result:       CalculationResult;
  ticker:       string;
  totalCapital: number;
  fetchedAt:    Date;
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(v);
}

function Tile({ label, value, sub, highlight = false, tooltip }: {
  label: string; value: string; sub?: React.ReactNode;
  highlight?: boolean; tooltip?: string;
}) {
  return (
    <div title={tooltip} className={`rounded-xl border p-4 flex flex-col gap-1 ${
      highlight
        ? "border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30"
        : "border-slate-700 bg-slate-800/60"
    }`}>
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-xl font-bold ${highlight ? "text-blue-300" : "text-slate-100"}`}>{value}</span>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ResultsPanel({ result, ticker, totalCapital, fetchedAt }: ResultsPanelProps) {
  const { entryPrice, riskPerShare, maxRiskAmount, positionSize, capitalRequired } = result;

  // Default to "limit" mode
  const [mode, setMode] = useState<"auto" | "limit">("limit");

  // Limit value: editable, defaults to 10% of capital
  const defaultLimit = Math.round(totalCapital * 0.1);
  const [limitValue, setLimitValue] = useState(defaultLimit);

  // Keep limit in sync if totalCapital changes (new calculation)
  useEffect(() => {
    setLimitValue(Math.round(totalCapital * 0.1));
    setMode("limit");
  }, [totalCapital, result]);

  const display = mode === "limit"
    ? recalculateWithCapitalLimit(limitValue, entryPrice, riskPerShare)
    : {
        positionSize,
        actualRisk:      parseFloat((riskPerShare * positionSize).toFixed(2)),
        capitalRequired,
      };

  const fetchTime = fetchedAt.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

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
        <Tile label="Entry Price"    value={formatINR(entryPrice)}  tooltip="Current market price fetched live" />
        <Tile label="Risk Per Share" value={formatINR(riskPerShare)} tooltip="Entry Price − Stop Loss" />
      </div>

      {/* Row 2: Position Size | Risk Amount */}
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Position Size"
          value={`${display.positionSize.toLocaleString("en-IN")} shares`}
          highlight
          tooltip="Shares you can buy within your risk/capital limit"
        />

        {/* Risk Amount — actual / max style */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Risk Amount</span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            {/* Actual */}
            <span className="text-xl font-bold text-slate-100">
              {formatINR(display.actualRisk)}
            </span>
            {/* Max — faded */}
            <span className="text-sm text-slate-500">
              / {formatINR(maxRiskAmount)}
            </span>
          </div>
          <div className="flex gap-2 mt-0.5">
            <span className="text-xs text-slate-500">actual / max</span>
          </div>
        </div>
      </div>

      {/* Capital Required with mode toggle + editable limit */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-3">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Capital Required
          </span>
          <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs font-medium">
            {(["limit", "auto"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 capitalize transition-colors ${
                  mode === m
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Value */}
        <span className="text-2xl font-bold text-slate-100">
          {formatINR(display.capitalRequired)}
        </span>

        {/* Editable limit — only shown in limit mode */}
        {mode === "limit" && (
          <div className="flex flex-col gap-2 pt-1 border-t border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Capital limit</span>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">₹</span>
                <input
                  type="number"
                  value={limitValue}
                  onChange={(e) => setLimitValue(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-24 rounded-md border border-slate-600 bg-slate-900 px-2 py-0.5
                    text-slate-100 text-xs text-right focus:outline-none focus:ring-1
                    focus:ring-blue-500"
                  min={1}
                  step={1000}
                />
              </div>
            </div>
            {/* Slider: range 0 to totalCapital */}
            <input
              type="range"
              min={entryPrice}           // minimum: enough to buy 1 share
              max={totalCapital}
              step={1000}
              value={limitValue}
              onChange={(e) => setLimitValue(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-slate-600">
              <span>₹{entryPrice.toLocaleString("en-IN")}</span>
              <span className="text-slate-500">
                default {formatINR(defaultLimit)} (10%)
              </span>
              <span>₹{totalCapital.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}

        {mode === "auto" && (
          <span className="text-xs text-slate-500 italic">
            Full capital needed for this position
          </span>
        )}

      </div>

    </div>
  );
}