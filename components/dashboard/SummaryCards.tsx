"use client";

import { Trade } from "@/lib/db/trades";

interface SummaryCardsProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

const CLOSED_STATUSES = ["CLOSED", "STOPPED", "TARGET_HIT"] as const;

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

function Card({ label, value, sub, sub2, valueColour = "text-slate-900 dark:text-slate-100" }: {
  label: string; value: string; sub?: string; sub2?: string; valueColour?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${valueColour}`}>{value}</span>
      {sub  && <span className="text-xs text-slate-400 dark:text-slate-600">{sub}</span>}
      {sub2 && <span className="text-xs text-slate-400 dark:text-slate-600">{sub2}</span>}
    </div>
  );
}

export default function SummaryCards({ trades, livePrices }: SummaryCardsProps) {
  const open    = trades.filter(t => t.status === "OPEN");
  const closed  = trades.filter(t => (CLOSED_STATUSES as readonly string[]).includes(t.status));
  const winners = closed.filter(t => (t.realised_pnl ?? 0) > 0);
  const losers  = closed.filter(t => (t.realised_pnl ?? 0) < 0);
  const breakeven = closed.filter(t => (t.realised_pnl ?? 0) === 0);

  const realisedPnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
  const unrealisedPnl = open.reduce((s, t) => {
    const ltp = livePrices[t.ticker];
    return s + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
  }, 0);
  const totalPnl = realisedPnl + unrealisedPnl;

  const winRate = closed.length > 0
    ? ((winners.length / closed.length) * 100).toFixed(0)
    : "—";

  const avgWin  = winners.length > 0
    ? winners.reduce((s, t) => s + (t.realised_pnl ?? 0), 0) / winners.length : 0;
  const avgLoss = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + (t.realised_pnl ?? 0), 0) / losers.length) : 0;
  const rrRatio = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "—";

  // Avg R across all closed trades with risk data
  const rValues = closed
    .filter(t => (t.risk_amount ?? 0) > 0 && t.realised_pnl !== null)
    .map(t => (t.realised_pnl ?? 0) / (t.risk_amount ?? 1));
  const avgR = rValues.length > 0
    ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null;

  // Profit factor
  const grossWin  = winners.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.realised_pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* Total P&L */}
      <Card
        label="Total P&L"
        value={`${totalPnl >= 0 ? "+" : ""}${formatINR(totalPnl)}`}
        sub={`${formatINR(realisedPnl)} realised`}
        sub2={`${unrealisedPnl >= 0 ? "+" : ""}${formatINR(unrealisedPnl)} open`}
        valueColour={totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
      />

      {/* Win rate */}
      <Card
        label="Win Rate"
        value={winRate === "—" ? "—" : `${winRate}%`}
        sub={`${winners.length}W · ${losers.length}L · ${breakeven.length}B`}
        sub2={`of ${closed.length} closed trades`}
        valueColour={winRate !== "—" && parseInt(winRate) >= 50 ? "text-emerald-400" : "text-red-400"}
      />

      {/* Avg R */}
      <Card
        label="Avg R"
        value={avgR !== null ? `${avgR >= 0 ? "+" : ""}${avgR.toFixed(2)}R` : "—"}
        sub={rValues.length > 0 ? `across ${rValues.length} trades` : "No closed trades"}
        sub2={`Profit factor: ${profitFactor}`}
        valueColour={avgR === null ? "text-slate-400 dark:text-slate-400" : avgR >= 0 ? "text-emerald-400" : "text-red-400"}
      />

      {/* Portfolio health */}
      <Card
        label="Portfolio"
        value={`${open.length} open`}
        sub={`${closed.length} closed · ${trades.filter(t => t.status === "QUEUED").length} queued`}
        sub2={`W:L ratio ${rrRatio}`}
        valueColour="text-blue-300"
      />
    </div>
  );
}