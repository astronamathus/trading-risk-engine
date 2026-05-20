"use client";

import { useState } from "react";
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
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(v);
}

function Tile({
  label, value, sub, highlight = false, tooltip,
}: {
  label: string; value: string; sub?: React.ReactNode;
  highlight?: boolean; tooltip?: string;
}) {
  return (
    <div
      title={tooltip}
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        highlight
          ? "border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30"
          : "border-slate-700 bg-slate-800/60"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <span className={`text-xl font-bold ${highlight ? "text-blue-300" : "text-slate-100"}`}>
        {value}
      </span>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ResultsPanel({ result, ticker, totalCapital, fetchedAt }: ResultsPanelProps) {
  const [mode, setMode] = useState<"auto" | "limit">("auto");

  const { entryPrice, riskPerShare, maxRiskAmount, positionSize, capitalRequired } = result;

  const capitalLimit = parseFloat((totalCapital * 0.1).toFixed(2));

  const display = mode === "limit"
    ? recalculateWithCapitalLimit(capitalLimit, entryPrice, riskPerShare)
    : {
        positionSize,
        actualRisk:      parseFloat((riskPerShare * positionSize).toFixed(2)),
        capitalRequired,
      };

  // Risk as % of total capital — updates with mode
  const riskPct = ((display.actualRisk / totalCapital) * 100).toFixed(2);

  // Format fetch time as "3:42:05 PM"
  const fetchTime = fetchedAt.toLocaleTimeString("en-IN", {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="flex flex-col gap-4">

      {/* Header: ticker + fetch timestamp */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">
          <span className="text-blue-400 font-mono">{ticker.toUpperCase()}</span>
        </h2>
        {/* Subtle timestamp */}
        <span className="text-xs text-slate-600" title="Time price was last fetched">
          fetched {fetchTime}
        </span>
      </div>

      {/* Row 1: Entry Price | Risk Per Share */}
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Entry Price"
          value={formatINR(entryPrice)}
          tooltip="Current market price fetched live"
        />
        <Tile
          label="Risk Per Share"
          value={formatINR(riskPerShare)}
          tooltip="Entry Price − Stop Loss"
        />
      </div>

      {/* Row 2: Position Size | Risk Amount */}
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Position Size"
          value={`${display.positionSize.toLocaleString("en-IN")} shares`}
          highlight
          tooltip="Shares you can buy within your risk limit"
        />
        <Tile
          label="Risk Amount"
          value={formatINR(display.actualRisk)}
          sub={
            <span>
              {/* Risk % of total capital — the key line */}
              <span className="text-amber-400 font-medium">{riskPct}%</span>
              {" of capital · max "}
              <span>{formatINR(maxRiskAmount)}</span>
            </span>
          }
          tooltip="Actual risk vs your max risk budget"
        />
      </div>

      {/* Row 3: Capital Required with toggle */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Capital Required
          </span>
          <div className="flex rounded-lg overflow-hidden border border-slate-600 text-xs font-medium">
            {(["auto", "limit"] as const).map((m) => (
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

        <span className="text-2xl font-bold text-slate-100">
          {formatINR(display.capitalRequired)}
        </span>

        <span className="text-xs text-slate-500 italic">
          {mode === "auto"
            ? "Full capital needed for this position"
            : `Capped at 10% of capital (${formatINR(capitalLimit)}) — shares and risk updated`}
        </span>
      </div>

    </div>
  );
}