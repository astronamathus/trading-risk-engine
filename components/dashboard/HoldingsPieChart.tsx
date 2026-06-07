"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Trade } from "@/lib/db/trades";

interface HoldingsPieChartProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

// Semi-transparent colours matching our badge palette
const SLICE_COLOURS = [
  { fill: "rgba(16,185,129,0.15)",  stroke: "#10b981" }, // emerald
  { fill: "rgba(96,165,250,0.15)",  stroke: "#60a5fa" }, // blue
  { fill: "rgba(245,158,11,0.15)",  stroke: "#f59e0b" }, // amber
  { fill: "rgba(244,114,182,0.15)", stroke: "#f472b6" }, // pink
  { fill: "rgba(167,139,250,0.15)", stroke: "#a78bfa" }, // violet
  { fill: "rgba(52,211,153,0.15)",  stroke: "#34d399" }, // teal
  { fill: "rgba(251,146,60,0.15)",  stroke: "#fb923c" }, // orange
  { fill: "rgba(56,189,248,0.15)",  stroke: "#38bdf8" }, // sky
];

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

export default function HoldingsPieChart({ trades, livePrices }: HoldingsPieChartProps) {
  const data = useMemo(() => {
    return trades
      .filter(t => t.status === "OPEN")
      .map(t => {
        const ltp   = livePrices[t.ticker] ?? t.entry_price;
        const value = ltp * t.quantity;
        return {
          name:  t.ticker.replace(/\.(NS|BO)$/, ""),
          value: Math.round(value),
          full:  t.ticker,
        };
      })
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [trades, livePrices]);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d   = payload[0];
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
    const idx = data.findIndex(x => x.name === d.name) % SLICE_COLOURS.length;
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs shadow-xl">
        <p style={{ color: SLICE_COLOURS[idx].stroke }} className="font-medium">{d.name}</p>
        <p className="text-slate-400">{formatINR(d.value)} · {pct}%</p>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-200">Holdings</h3>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
          No open positions to display.
        </div>
      ) : (
        <div className="flex items-center gap-6">
          {/* Donut */}
          <div className="w-36 h-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={64}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => {
                    const c = SLICE_COLOURS[i % SLICE_COLOURS.length];
                    return (
                      <Cell
                        key={i}
                        fill={c.fill}
                        stroke={c.stroke}
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </Pie>
                <Tooltip content={<CustomTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {data.map((d, i) => {
              const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
              const c   = SLICE_COLOURS[i % SLICE_COLOURS.length];
              return (
                <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border"
                      style={{ backgroundColor: c.fill, borderColor: c.stroke }}
                    />
                    <span className="text-slate-300 font-mono truncate">{d.name}</span>
                  </div>
                  <span className="text-slate-500 tabular-nums shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.length > 0 && (
        <div className="border-t border-slate-700 pt-3 text-xs text-slate-500 flex justify-between">
          <span>Total value</span>
          <span className="text-slate-300 font-medium tabular-nums">{formatINR(total)}</span>
        </div>
      )}
    </div>
  );
}