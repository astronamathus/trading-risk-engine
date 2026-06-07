"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Trade } from "@/lib/db/trades";

interface HoldingsPieChartProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

const COLOURS = [
  "#10b981", "#60a5fa", "#f59e0b", "#f472b6",
  "#a78bfa", "#34d399", "#fb923c", "#38bdf8",
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
    const d = payload[0];
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-200 font-medium">{d.name}</p>
        <p className="text-slate-400">{formatINR(d.value)} · {pct}%</p>
      </div>
    );
  };

  const CustomLegend = () => (
    <div className="flex flex-col gap-1.5 justify-center">
      {data.map((d, i) => {
        const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
        return (
          <div key={d.name} className="flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLOURS[i % COLOURS.length] }}/>
              <span className="text-slate-300 font-mono">{d.name}</span>
            </div>
            <span className="text-slate-500 tabular-nums">{pct}%</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-200">Holdings</h3>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
          No open positions to display.
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="w-36 h-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={62}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLOURS[i % COLOURS.length]}/>
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <CustomLegend/>
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