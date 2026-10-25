"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { Trade } from "@/lib/db/trades";
import { formatMoney, marketFromTicker } from "@/lib/currency";

interface EquityCurveProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

const CLOSED_STATUSES = ["CLOSED", "STOPPED", "TARGET_HIT"] as const;

function formatINR(v: number, ticker: string) { return formatMoney(v, marketFromTicker(ticker)); }

function pickTicks(len: number, max = 6): number[] {
  if (len <= max) return Array.from({ length: len }, (_, i) => i);
  const step = (len - 1) / (max - 1);
  const picks = Array.from({ length: max }, (_, i) => Math.round(i * step));
  picks[max - 1] = len - 1;
  return [...new Set(picks)];
}

function tickLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export default function EquityCurve({ trades, livePrices }: EquityCurveProps) {
  const availableCurrencies = [...new Set(trades.map(t => t.currency ?? marketFromTicker(t.ticker)))];
  const [selectedCurrency, setSelectedCurrency] = useState<"INR" | "USD" | null>(null);
  const activeCurrency = selectedCurrency ?? (availableCurrencies.includes("INR") ? "INR" : "USD");
  const currencyTrades = trades.filter(t => (t.currency ?? marketFromTicker(t.ticker)) === activeCurrency);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { fullSeries, monthlyBars, openMtm } = useMemo(() => {
    const closed = currencyTrades
      .filter(t => (CLOSED_STATUSES as readonly string[]).includes(t.status) && t.realised_pnl !== null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Current unrealised P&L across all open positions
    const openPnl = currencyTrades
      .filter(t => t.status === "OPEN")
      .reduce((s, t) => {
        const ltp = livePrices[t.ticker];
        return s + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
      }, 0);

    // Build realised cumulative series
    let cum = 0;
    const points = closed.map(t => {
      cum += t.realised_pnl ?? 0;
      return {
        ts:       new Date(t.created_at).getTime(),
        realised: Math.round(cum),
        ticker:   t.ticker,
        month:    new Date(t.created_at).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      };
    });

    // MTM series = realised equity + current open P&L plotted at every point
    // Then a final "Now" point showing today's combined equity
    const pointsWithMtm = points.map(p => ({
      ...p,
      // MTM runs alongside realised — it's realised + open unrealised at this moment
      // (we don't have historical open P&L, so MTM is a flat offset of current open pnl)
      mtm: openPnl !== 0 ? Math.round(p.realised + openPnl) : null,
    }));

    // Add a "Now" point to anchor MTM to today's date.
    // realised is null so the green realised line ends at the last closed trade —
    // only the MTM dashed line extends forward to show current open P&L.
    if (pointsWithMtm.length > 0 && openPnl !== 0) {
      pointsWithMtm.push({
        ts:       Date.now(),
        realised: null as unknown as number,
        mtm:      Math.round(cum + openPnl),
        ticker:   "",
        month:    new Date().toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      });
    }

    // Monthly P&L
    const map: Record<string, number> = {};
    closed.forEach(t => {
      const key = new Date(t.created_at).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      map[key] = (map[key] ?? 0) + (t.realised_pnl ?? 0);
    });
    const monthlyBars = Object.entries(map).map(([month, pnl]) => ({ month, pnl: Math.round(pnl) }));

    return { fullSeries: pointsWithMtm, monthlyBars, openMtm: Math.round(openPnl) };
  }, [currencyTrades, livePrices]);

  // Filter to selected month (rebased to zero at month start)
  const series = useMemo(() => {
    if (!selectedMonth) return fullSeries;
    const filtered = fullSeries.filter(p => p.month === selectedMonth);
    if (filtered.length === 0) return [];
    const baseVal = fullSeries.filter(p => p.ts < filtered[0].ts).slice(-1)[0]?.realised ?? 0;
    return filtered.map(p => ({
      ...p,
      realised: Math.round(p.realised - baseVal),
      mtm:      p.mtm !== null ? Math.round(p.mtm - baseVal) : null,
    }));
  }, [fullSeries, selectedMonth]);

  const tickIndices = useMemo(() => new Set(pickTicks(series.length)), [series.length]);
  // dataKey is now "ts" so every point is uniquely identified by timestamp.
  // The sparse label set is used only for tick display via tickFormatter.
  // Previously using dataKey="label" caused all points with label="" to be
  // treated as the same x position, so hovering any unlabelled point snapped
  // the tooltip to the first point (27 May).
  const tickTsSet = useMemo(
    () => new Set(series.filter((_, i) => tickIndices.has(i)).map(p => p.ts)),
    [series, tickIndices]
  );
  const chartData = useMemo(() => series, [series]);

  const isEmpty       = chartData.length === 0;
  const lastRealised  = chartData[chartData.length - 1]?.realised ?? 0;
  const lastMtm       = chartData[chartData.length - 1]?.mtm ?? lastRealised;
  const displayTotal  = openMtm !== 0 && !selectedMonth ? lastMtm : lastRealised;
  const isPositive    = displayTotal >= 0;
  const hasMtm        = openMtm !== 0 && !selectedMonth;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const ts = payload[0]?.payload?.ts;
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-600
        bg-white dark:bg-slate-900 px-3 py-2.5 text-xs shadow-xl min-w-[160px]">
        {ts && (
          <p className="text-slate-500 dark:text-slate-400 mb-2 font-medium">
            {tickLabel(ts)}
          </p>
        )}
        {payload.map((p: any) => (
          p.value !== null && p.value !== undefined ? (
            <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
              <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ background: p.color }}/>
                {p.name}
              </span>
              <span className="font-semibold tabular-nums"
                style={{ color: p.value >= 0 ? "#10b981" : "#f87171" }}>
                {p.value >= 0 ? "+" : ""}{formatINR(p.value, chartData[0]?.ticker ?? "RELIANCE.NS")}
              </span>
            </div>
          ) : null
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700
      bg-white dark:bg-slate-800/50 p-5 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Portfolio Equity Curve
          </h3>
          {selectedMonth && (
            <button onClick={() => setSelectedMonth(null)}
              className="text-xs px-2 py-0.5 rounded-full border border-slate-300
                dark:border-slate-600 text-slate-500 dark:text-slate-400
                hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              {selectedMonth} ✕
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {availableCurrencies.length > 1 && (["INR", "USD"] as const).map(currency => (
            <button key={currency} onClick={() => { setSelectedCurrency(currency); setSelectedMonth(null); }}
              className={`text-xs px-2 py-1 rounded-lg border transition-colors ${activeCurrency === currency ? "border-blue-500 bg-blue-600 text-white" : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400"}`}>
              {currency}
            </button>
          ))}
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          {!isEmpty && (
            <span className={`font-semibold ${isPositive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"}`}>
              {isPositive ? "+" : ""}{formatINR(displayTotal, chartData[chartData.length - 1]?.ticker ?? "RELIANCE.NS")} total
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 bg-emerald-500 inline-block rounded"/>
            Realised
          </span>
          {hasMtm && (
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-blue-400 inline-block rounded"
                style={{ borderTop: "2px dashed #60a5fa", height: 0 }}/>
              MTM
            </span>
          )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {isEmpty ? (
        <div className="flex items-center justify-center h-48
          text-slate-400 dark:text-slate-600 text-sm">
          Close some trades to see your equity curve.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="realisedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isPositive ? "#10b981" : "#f87171"} stopOpacity={0.2}/>
                <stop offset="95%" stopColor={isPositive ? "#10b981" : "#f87171"} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="mtmGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.15}/>
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"
              strokeOpacity={0.35} vertical={false}/>

            <XAxis
              dataKey="ts"
              scale="time"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false} tickLine={false}
              ticks={series.filter((_, i) => tickIndices.has(i)).map(p => p.ts)}
              tickFormatter={ts => tickTsSet.has(ts) ? tickLabel(ts) : ""}
            />

            <YAxis
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => formatINR(v, chartData[0]?.ticker ?? "RELIANCE.NS")}
              width={58}
            />

            <ReferenceLine y={0} stroke="#94a3b8"
              strokeDasharray="4 2" strokeOpacity={0.6}/>

            <Tooltip content={<CustomTooltip/>}/>

            {/* MTM below realised so realised renders on top */}
            {hasMtm && (
              <Area
                type="monotone"
                dataKey="mtm"
                name="MTM"
                stroke="#60a5fa"
                strokeWidth={1.5}
                strokeDasharray="6 3"
                fill="url(#mtmGrad)"
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                connectNulls
              />
            )}

            <Area
              type="monotone"
              dataKey="realised"
              name="Realised"
              stroke={isPositive ? "#10b981" : "#f87171"}
              strokeWidth={2}
              fill="url(#realisedGrad)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              connectNulls={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Monthly chips */}
      {monthlyBars.length > 0 && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-xs text-slate-400 dark:text-slate-500
            uppercase tracking-wider mb-3">
            Monthly P&L · click to zoom
          </p>
          <div className="flex gap-2 flex-wrap">
            {monthlyBars.map(({ month, pnl }) => {
              const active = selectedMonth === month;
              const pos    = pnl >= 0;
              return (
                <button key={month}
                  onClick={() => setSelectedMonth(active ? null : month)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                    border text-xs transition-all cursor-pointer
                    focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    active
                      ? pos
                        ? "border-emerald-500 bg-emerald-500/20 ring-2 ring-emerald-400/30"
                        : "border-red-500 bg-red-500/20 ring-2 ring-red-400/30"
                      : pos
                        ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                        : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40"
                  }`}>
                  <span className="text-slate-500 dark:text-slate-400">{month}</span>
                  <span className={`font-semibold tabular-nums ${
                    pos
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {pos ? "+" : ""}{formatINR(pnl, currencyTrades.find(t => new Date(t.created_at).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }) === month)?.ticker ?? "RELIANCE.NS")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}