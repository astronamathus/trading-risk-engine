"use client";

// ============================================================
// components/dashboard/OpenRiskCard.tsx
//
// Merged card: Trade Health + Risk Allocation + Risk Table
// Layout:
//   ┌─────────────────────────────────────────────────────┐
//   │ Header: "Open Positions (N)"      N% winning        │
//   ├──────────────────────┬──────────────────────────────┤
//   │ Winning / Losing     │  Donut + legend              │
//   │ chips                │                              │
//   ├──────────────────────┴──────────────────────────────┤
//   │ Risk table (stock · risk ₹ · % · SL/TG · dd · days)│
//   └─────────────────────────────────────────────────────┘
// ============================================================

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Trade } from "@/lib/db/trades";

interface Props {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

// ── Colours ───────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────
function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

// SL/TG progress bar — grey track, entry tick, green/red fill
function SlTgBar({ entry, sl, ltp }: { entry: number; sl: number; ltp: number | undefined }) {
  if (ltp === undefined || sl >= entry) {
    return <div className="w-16 h-1 rounded-full bg-slate-200 dark:bg-slate-700"/>;
  }
  const riskDist   = entry - sl;
  const tg         = entry + 2 * riskDist;
  const totalRange = tg - sl;
  const entryPct   = ((entry - sl) / totalRange) * 100;
  const ltpClamped = Math.max(sl, Math.min(tg, ltp));
  const ltpPct     = ((ltpClamped - sl) / totalRange) * 100;
  const above      = ltp >= entry;
  const barLeft    = above ? entryPct : ltpPct;
  const barWidth   = Math.abs(ltpPct - entryPct);
  return (
    <div className="relative w-16 h-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-visible">
      <div className={`absolute top-0 h-full rounded-full ${above ? "bg-emerald-500" : "bg-red-500"}`}
        style={{ left: `${barLeft}%`, width: `${barWidth}%` }}/>
      <div className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-slate-400 dark:bg-slate-500"
        style={{ left: `${entryPct}%` }}/>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function OpenRiskCard({ trades, livePrices }: Props) {
  const open = trades.filter(t => t.status === "OPEN");

  // ── Health categorisation ─────────────────────────────────
  const categorised = open.map(t => {
    const ltp  = livePrices[t.ticker];
    const risk = t.risk_amount ?? 0;
    if (ltp === undefined || risk === 0) return { trade: t, winning: null };
    const pnl    = (ltp - t.entry_price) * t.quantity;
    const target = t.entry_price + 2 * (t.entry_price - t.stop_loss);
    return { trade: t, winning: ltp >= target || pnl > 0 };
  });

  const winning = categorised.filter(c => c.winning === true);
  const losing  = categorised.filter(c => c.winning === false);
  const pending = categorised.filter(c => c.winning === null);
  const winRate = (winning.length + losing.length) > 0
    ? ((winning.length / (winning.length + losing.length)) * 100).toFixed(0)
    : null;

  // ── Pie data ──────────────────────────────────────────────
  const pieData = useMemo(() => open
    .filter(t => (t.risk_amount ?? 0) > 0)
    .map(t => ({
      name:     t.ticker.replace(/\.(NS|BO)$/, ""),
      value:    t.risk_amount ?? 0,
      capital:  t.entry_price * t.quantity,
    }))
    .sort((a, b) => b.value - a.value),
  [open]);

  const totalRisk = pieData.reduce((s, d) => s + d.value, 0);

  // ── Risk table rows ───────────────────────────────────────
  const tableRows = useMemo(() => open.map(t => {
    const ltp      = livePrices[t.ticker];
    const riskAmt  = t.risk_amount ?? 0;
    const riskPct  = totalRisk > 0 ? (riskAmt / totalRisk) * 100 : 0;
    const drawdown = ltp !== undefined ? Math.min(0, (ltp - t.entry_price) * t.quantity) : 0;
    const daysHeld = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000);
    const sl       = t.stop_loss ?? (t.entry_price - riskAmt / t.quantity);
    return { trade: t, ltp, riskAmt, riskPct, drawdown, daysHeld, sl };
  }).sort((a, b) => b.riskAmt - a.riskAmt), [open, livePrices, totalRisk]);

  const totalDrawdown = tableRows.reduce((s, r) => s + r.drawdown, 0);

  const PieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d   = payload[0];
    const pct = totalRisk > 0 ? ((d.value / totalRisk) * 100).toFixed(1) : "0";
    const idx = pieData.findIndex(x => x.name === d.name) % SLICE_COLOURS.length;
    const cap = pieData[idx]?.capital ?? 0;
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs shadow-xl">
        <p style={{ color: SLICE_COLOURS[idx].stroke }} className="font-medium">{d.name}</p>
        <p className="text-slate-400">Risk: {formatINR(d.value)} · {pct}%</p>
        <p className="text-slate-400">Capital: {formatINR(cap)}</p>
      </div>
    );
  };

  // ── Chip row helper ───────────────────────────────────────
  function Chips({ items, badge }: { items: typeof categorised; badge: string }) {
    if (!items.length) return null;
    return (
      <div className="flex flex-wrap gap-1.5 mt-1 pl-4">
        {items.map(c => (
          <span key={c.trade.id} className={`text-xs px-2 py-0.5 rounded-full border font-mono ${badge}`}>
            {c.trade.ticker.replace(/\.(NS|BO)$/, "")}
          </span>
        ))}
      </div>
    );
  }

  if (open.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6
        flex items-center justify-center text-sm text-slate-400 dark:text-slate-600 h-32">
        No open positions.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50
      flex flex-col divide-y divide-slate-100 dark:divide-slate-700/60">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Open Positions ({open.length})
        </h3>
        <div className="flex items-center gap-4 text-xs">
          {winRate !== null && (
            <span className="text-slate-400 dark:text-slate-500">
              <span className={`font-semibold ${parseInt(winRate) >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                {winRate}%
              </span>{" "}winning
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500">
            Total risk:{" "}
            <span className="text-amber-400 font-medium tabular-nums">{formatINR(totalRisk)}</span>
          </span>
        </div>
      </div>

      {/* ── Top section: chips left, donut right ────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x
        divide-slate-100 dark:divide-slate-700/60">

        {/* Health chips */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Winning */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"/>
                <span className="text-xs text-slate-400 dark:text-slate-400">Winning</span>
              </div>
              <span className={`text-sm font-semibold ${winning.length > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-600"}`}>
                {winning.length}
              </span>
            </div>
            <Chips items={winning}
              badge="border-emerald-400 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-100/60 dark:bg-emerald-900/20"/>
          </div>

          {/* Losing */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500"/>
                <span className="text-xs text-slate-400 dark:text-slate-400">Losing</span>
              </div>
              <span className={`text-sm font-semibold ${losing.length > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-600"}`}>
                {losing.length}
              </span>
            </div>
            <Chips items={losing}
              badge="border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 bg-red-100/60 dark:bg-red-900/20"/>
          </div>

          {pending.length > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-600 pl-4">
              {pending.length} awaiting price data…
            </p>
          )}
        </div>

        {/* Donut + legend */}
        <div className="px-5 py-4 flex items-center gap-5">
          <div className="w-28 h-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%"
                  innerRadius={30} outerRadius={52}
                  paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {pieData.map((_, i) => {
                    const c = SLICE_COLOURS[i % SLICE_COLOURS.length];
                    return <Cell key={i} fill={c.fill} stroke={c.stroke} strokeWidth={1.5}/>;
                  })}
                </Pie>
                <Tooltip content={<PieTooltip/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            {pieData.map((d, i) => {
              const pct = totalRisk > 0 ? ((d.value / totalRisk) * 100).toFixed(1) : "0";
              const c   = SLICE_COLOURS[i % SLICE_COLOURS.length];
              return (
                <div key={d.name} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0 border"
                      style={{ backgroundColor: c.fill, borderColor: c.stroke }}/>
                    <span className="text-slate-700 dark:text-slate-300 font-mono truncate">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-slate-400 dark:text-slate-500 tabular-nums">
                    <span>{formatINR(d.capital)}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span>{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Risk table ───────────────────────────────────────── */}
      <div className="px-5 py-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider
              text-slate-400 dark:text-slate-500">
              <th className="pb-2 pr-4 text-left font-medium">Stock</th>
              <th className="pb-2 pr-4 text-left font-medium">Risk ₹</th>
              <th className="pb-2 pr-4 text-left font-medium">Pool %</th>
              <th className="pb-2 pr-6 text-left font-medium">SL · TG</th>
              <th className="pb-2 pr-4 text-left font-medium">Drawdown</th>
              <th className="pb-2 text-left font-medium">Days</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {tableRows.map(({ trade, ltp, riskAmt, riskPct, drawdown, daysHeld, sl }) => (
              <tr key={trade.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 pr-4">
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {trade.ticker.replace(/\.(NS|BO)$/, "")}
                  </span>
                  <div className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                    {new Date(trade.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </div>
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-slate-700 dark:text-slate-300">
                  {formatINR(riskAmt)}
                </td>
                <td className="py-2.5 pr-4 tabular-nums text-slate-400 dark:text-slate-500">
                  {riskPct.toFixed(1)}%
                </td>
                <td className="py-2.5 pr-6">
                  <SlTgBar entry={trade.entry_price} sl={sl} ltp={ltp}/>
                </td>
                <td className={`py-2.5 pr-4 tabular-nums text-xs font-medium ${
                  drawdown < 0 ? "text-red-400" : "text-slate-400 dark:text-slate-600"
                }`}>
                  {drawdown < 0 ? formatINR(drawdown) : "—"}
                </td>
                <td className="py-2.5 tabular-nums text-slate-400 dark:text-slate-500 text-xs">
                  {daysHeld === 0 ? "Today" : `${daysHeld}d`}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 dark:divide-slate-700">
            <tr className="text-xs text-slate-400 dark:text-slate-500">
              <td className="pt-3 font-medium text-slate-500 dark:text-slate-400">
                {tableRows.length} position{tableRows.length !== 1 ? "s" : ""}
              </td>
              <td className="pt-3 tabular-nums text-amber-400 font-medium">{formatINR(totalRisk)}</td>
              <td className="pt-3">100%</td>
              <td className="pt-3"/>
              <td className={`pt-3 tabular-nums font-medium ${totalDrawdown < 0 ? "text-red-400" : "text-slate-500 dark:text-slate-600"}`}>
                {totalDrawdown < 0 ? formatINR(totalDrawdown) : "—"}
              </td>
              <td className="pt-3"/>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  );
}