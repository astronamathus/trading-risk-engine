"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Trade } from "@/lib/db/trades";

interface RiskPieChartProps {
  trades: Trade[];
}

const SLICE_COLOURS = [
  { fill: "rgba(16,185,129,0.15)",  stroke: "#10b981" },
  { fill: "rgba(96,165,250,0.15)",  stroke: "#60a5fa" },
  { fill: "rgba(245,158,11,0.15)",  stroke: "#f59e0b" },
  { fill: "rgba(244,114,182,0.15)", stroke: "#f472b6" },
  { fill: "rgba(167,139,250,0.15)", stroke: "#a78bfa" },
  { fill: "rgba(52,211,153,0.15)",  stroke: "#34d399" },
  { fill: "rgba(251,146,60,0.15)",  stroke: "#fb923c" },
  { fill: "rgba(56,189,248,0.15)",  stroke: "#38bdf8" },
];

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

export default function RiskPieChart({ trades }: RiskPieChartProps) {
  const data = useMemo(() => {
    return trades
      .filter(t => t.status === "OPEN" && (t.risk_amount ?? 0) > 0)
      .map(t => ({
        name:  t.ticker.replace(/\.(NS|BO)$/, ""),
        value: t.risk_amount ?? 0,
        full:  t.ticker,
      }))
      .sort((a, b) => b.value - a.value);
  }, [trades]);

  const total = data.reduce((s, d) => s + d.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d   = payload[0];
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
    const idx = data.findIndex(x => x.name === d.name) % SLICE_COLOURS.length;
    return (
      <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-xl">
        <p style={{ color: SLICE_COLOURS[idx].stroke }} className="font-medium">{d.name}</p>
        <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400">{formatINR(d.value)} at risk · {pct}%</p>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white dark:bg-slate-800/50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Risk Allocation</h3>
        <span className="text-xs text-slate-400 dark:text-slate-500">by risk amount</span>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-600 text-sm">
          No open positions with risk data.
        </div>
      ) : (
        <div className="flex items-center gap-6">
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
                      <Cell key={i} fill={c.fill} stroke={c.stroke} strokeWidth={1.5}/>
                    );
                  })}
                </Pie>
                <Tooltip content={<CustomTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-2 flex-1 min-w-0">
            {data.map((d, i) => {
              const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
              const c   = SLICE_COLOURS[i % SLICE_COLOURS.length];
              return (
                <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 border"
                      style={{ backgroundColor: c.fill, borderColor: c.stroke }}/>
                    <span className="text-slate-700 dark:text-slate-300 font-mono truncate">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 dark:text-slate-600 tabular-nums">{formatINR(d.value)}</span>
                    <span className="text-slate-400 dark:text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 text-xs text-slate-400 dark:text-slate-500 flex justify-between">
          <span>Total at risk</span>
          <span className="text-amber-400 font-medium tabular-nums">{formatINR(total)}</span>
        </div>
      )}
    </div>
  );
}