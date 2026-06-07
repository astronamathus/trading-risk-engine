"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { Trade } from "@/lib/db/trades";

interface EquityCurveProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short",
  });
}

export default function EquityCurve({ trades, livePrices }: EquityCurveProps) {
  // ── Series A: Closed Out (realised cumulative P&L) ───────
  const closedSeries = useMemo(() => {
    const closed = trades
      .filter(t => (t.status === "CLOSED" || t.status === "STOPPED") && t.realised_pnl !== null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let cum = 0;
    return closed.map(t => {
      cum += t.realised_pnl ?? 0;
      return { date: formatDate(t.created_at), pnl: Math.round(cum), ticker: t.ticker };
    });
  }, [trades]);

  // ── Series B: Mark to Market (unrealised cumulative by entry date) ─
  const mtmSeries = useMemo(() => {
    const open = trades
      .filter(t => t.status === "OPEN")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let cum = 0;
    return open.map(t => {
      const ltp  = livePrices[t.ticker];
      const pnl  = ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0;
      cum += pnl;
      return { date: formatDate(t.created_at), pnl: Math.round(cum), ticker: t.ticker };
    });
  }, [trades, livePrices]);

  // Merge both series by date for a unified x-axis
  const allDates = [...new Set([
    ...closedSeries.map(d => d.date),
    ...mtmSeries.map(d => d.date),
  ])];

  const merged = allDates.map(date => {
    const c = closedSeries.find(d => d.date === date);
    const m = mtmSeries.find(d => d.date === date);
    return { date, closed: c?.pnl, mtm: m?.pnl };
  });

  const isEmpty = closedSeries.length === 0 && mtmSeries.length === 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.color }} className="font-medium">
            {p.name}: {formatINR(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Equity Curve</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-emerald-500 inline-block rounded"/>
            Mark to Market
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-blue-400 inline-block rounded"/>
            Closed Out
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-40 text-slate-600 text-sm">
          No trade data yet — close some trades to see your equity curve.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={merged} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
            <XAxis
              dataKey="date"
              tick={{ fill: "#475569", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 2"/>
            <Tooltip content={<CustomTooltip/>}/>
            <Line
              type="monotone"
              dataKey="mtm"
              name="Mark to Market"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="closed"
              name="Closed Out"
              stroke="#60a5fa"
              strokeWidth={2}
              dot={{ fill: "#60a5fa", r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}