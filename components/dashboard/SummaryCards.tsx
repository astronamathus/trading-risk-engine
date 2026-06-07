"use client";

import { Trade } from "@/lib/db/trades";

interface SummaryCardsProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

function Card({
  label, value, sub, valueColour = "text-slate-100",
}: {
  label: string; value: string; sub?: string; valueColour?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${valueColour}`}>{value}</span>
      {sub && <span className="text-xs text-slate-600">{sub}</span>}
    </div>
  );
}

export default function SummaryCards({ trades, livePrices }: SummaryCardsProps) {
  const open    = trades.filter(t => t.status === "OPEN");
  const closed  = trades.filter(t => t.status === "CLOSED" || t.status === "STOPPED");
  const winners = closed.filter(t => (t.realised_pnl ?? 0) > 0);
  const losers  = closed.filter(t => (t.realised_pnl ?? 0) < 0);

  const realisedPnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
  const unrealisedPnl = open.reduce((s, t) => {
    const ltp = livePrices[t.ticker];
    return s + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
  }, 0);

  const winRate   = closed.length > 0
    ? ((winners.length / closed.length) * 100).toFixed(0)
    : "—";

  const avgWin    = winners.length > 0
    ? winners.reduce((s, t) => s + (t.realised_pnl ?? 0), 0) / winners.length
    : 0;
  const avgLoss   = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + (t.realised_pnl ?? 0), 0) / losers.length)
    : 0;
  const expectancy = avgLoss > 0
    ? (avgWin / avgLoss).toFixed(2)
    : "—";

  const totalTrades = trades.filter(
    t => t.status !== "QUEUED" && t.status !== "OPEN"
  ).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card
        label="Lifetime P&L"
        value={`${realisedPnl + unrealisedPnl >= 0 ? "+" : ""}${formatINR(realisedPnl + unrealisedPnl)}`}
        sub={`${formatINR(realisedPnl)} realised`}
        valueColour={(realisedPnl + unrealisedPnl) >= 0 ? "text-emerald-400" : "text-red-400"}
      />
      <Card
        label="Unrealised P&L"
        value={`${unrealisedPnl >= 0 ? "+" : ""}${formatINR(unrealisedPnl)}`}
        sub={`${open.length} open position${open.length !== 1 ? "s" : ""}`}
        valueColour={unrealisedPnl >= 0 ? "text-emerald-400" : "text-red-400"}
      />
      <Card
        label="Win Rate"
        value={winRate === "—" ? "—" : `${winRate}%`}
        sub={`${winners.length}W · ${losers.length}L of ${totalTrades} closed`}
        valueColour={parseInt(winRate) >= 50 ? "text-emerald-400" : "text-red-400"}
      />
      <Card
        label="Avg W:L Ratio"
        value={expectancy}
        sub={avgLoss > 0 ? `₹${Math.round(avgWin)} avg win · ₹${Math.round(avgLoss)} avg loss` : "No closed trades yet"}
        valueColour="text-blue-300"
      />
    </div>
  );
}