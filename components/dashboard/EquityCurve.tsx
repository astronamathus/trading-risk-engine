// ============================================================
// components/dashboard/EquityCurve.tsx — Equity Curve build
// ============================================================
"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { Trade } from "@/lib/db/trades";

interface EquityCurveProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

const CLOSED_STATUSES = ["CLOSED", "STOPPED", "TARGET_HIT"] as const;

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

  // Combined equity curve: each closed trade adds its P&L cumulatively
  // sorted by created_at, representing portfolio equity over time
  const equitySeries = useMemo(() => {
    const closed = trades
      .filter(t => (CLOSED_STATUSES as readonly string[]).includes(t.status) && t.realised_pnl !== null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let cum = 0;
    const points = closed.map(t => {
      cum += t.realised_pnl ?? 0;
      return {
        date:   formatDate(t.created_at),
        equity: Math.round(cum),
        ticker: t.ticker,
        pnl:    t.realised_pnl ?? 0,
        status: t.status,
      };
    });

    // Add current MTM point if there are open trades
    const openPnl = trades
      .filter(t => t.status === "OPEN")
      .reduce((s, t) => {
        const ltp = livePrices[t.ticker];
        return s + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
      }, 0);

    if (openPnl !== 0 && points.length > 0) {
      points.push({
        date:   "Now",
        equity: Math.round(cum + openPnl),
        ticker: "",
        pnl:    openPnl,
        status: "OPEN" as Trade["status"],
      });
    }

    return points;
  }, [trades, livePrices]);

  // Monthly P&L breakdown for bar reference
  const monthlyBars = useMemo(() => {
    const map: Record<string, number> = {};
    trades
      .filter(t => (CLOSED_STATUSES as readonly string[]).includes(t.status))
      .forEach(t => {
        const key = new Date(t.created_at).toLocaleDateString("en-IN", {
          month: "short", year: "2-digit",
        });
        map[key] = (map[key] ?? 0) + (t.realised_pnl ?? 0);
      });
    return Object.entries(map).map(([month, pnl]) => ({ month, pnl: Math.round(pnl) }));
  }, [trades]);

  const isEmpty = equitySeries.length === 0;
  const finalEquity = equitySeries[equitySeries.length - 1]?.equity ?? 0;
  const isPositive  = finalEquity >= 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-xl">
        <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <p className="font-semibold" style={{ color: d.value >= 0 ? "#10b981" : "#f87171" }}>
          Portfolio: {formatINR(d.value)}
        </p>
        {payload[1] && (
          <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">
            Trade: {payload[1].value >= 0 ? "+" : ""}{formatINR(payload[1].value)}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white dark:bg-slate-800/50 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Portfolio Equity Curve</h3>
        <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
          {!isEmpty && (
            <span className={`font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{formatINR(finalEquity)} total
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-emerald-500 inline-block rounded"/>
            Cumulative P&L
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex items-center justify-center h-48 text-slate-400 dark:text-slate-600 text-sm">
          Close some trades to see your equity curve.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={equitySeries} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isPositive ? "#10b981" : "#f87171"} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={isPositive ? "#10b981" : "#f87171"} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false}/>
            <XAxis
              dataKey="date"
              tick={{ fill: "#475569", fontSize: 11 }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tick={{ fill: "#475569", fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
              width={52}
            />
            <ReferenceLine y={0} stroke="#334155" strokeDasharray="4 2"/>
            <Tooltip content={<CustomTooltip/>}/>
            <Area
              type="monotone"
              dataKey="equity"
              name="Portfolio"
              stroke={isPositive ? "#10b981" : "#f87171"}
              strokeWidth={2}
              fill="url(#equityGrad)"
              dot={{ fill: isPositive ? "#10b981" : "#f87171", r: 3, strokeWidth: 0 }}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Monthly P&L summary row */}
      {monthlyBars.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">Monthly P&L</p>
          <div className="flex gap-2 flex-wrap">
            {monthlyBars.map(({ month, pnl }) => (
              <div key={month}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border text-xs
                  ${pnl >= 0
                    ? "border-emerald-800 bg-emerald-900/20 text-emerald-400"
                    : "border-red-900 bg-red-900/20 text-red-400"
                  }`}>
                <span className="text-slate-400 dark:text-slate-500 text-xs">{month}</span>
                <span className="font-semibold tabular-nums">
                  {pnl >= 0 ? "+" : ""}{formatINR(pnl)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}