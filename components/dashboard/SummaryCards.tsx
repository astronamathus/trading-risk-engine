"use client";

import { Trade } from "@/lib/db/trades";

interface SummaryCardsProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

const CLOSED_STATUSES = ["CLOSED", "STOPPED", "TARGET_HIT"] as const;

// Space between sign and ₹ symbol, no colour
function fmt(v: number): string {
  const abs = new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Math.abs(v));
  if (v > 0) return `+ ${abs}`;
  if (v < 0) return `- ${abs}`;
  return abs;
}

function Card({ label, value, sub, sub2 }: {
  label: string; value: string; sub?: string; sub2?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700
      bg-slate-50 dark:bg-slate-800/60 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider
        text-slate-400 dark:text-slate-500">{label}</span>
      <span className="text-xl font-bold tabular-nums
        text-slate-900 dark:text-slate-100">{value}</span>
      {sub  && <span className="text-xs text-slate-400 dark:text-slate-600">{sub}</span>}
      {sub2 && <span className="text-xs text-slate-400 dark:text-slate-600">{sub2}</span>}
    </div>
  );
}

export default function SummaryCards({ trades, livePrices }: SummaryCardsProps) {
  const open      = trades.filter(t => t.status === "OPEN");
  const closed    = trades.filter(t => (CLOSED_STATUSES as readonly string[]).includes(t.status));
  const winners   = closed.filter(t => (t.realised_pnl ?? 0) > 0);
  const losers    = closed.filter(t => (t.realised_pnl ?? 0) < 0);
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

  // Return % = total P&L / capital
  const capital    = trades.find(t => t.capital)?.capital ?? 100000;
  const returnPct  = capital > 0 ? (totalPnl / capital) * 100 : 0;
  const returnSign = returnPct > 0 ? "+" : returnPct < 0 ? "-" : "";

  // Profit factor
  const grossWin  = winners.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.realised_pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—";

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card
        label="Total P&L"
        value={fmt(totalPnl)}
        sub={`${fmt(realisedPnl)} realised`}
        sub2={`${fmt(unrealisedPnl)} open`}
      />
      <Card
        label="Win Rate"
        value={winRate === "—" ? "—" : `${winRate}%`}
        sub={`${winners.length}W · ${losers.length}L · ${breakeven.length}B`}
        sub2={`of ${closed.length} closed trades`}
      />
      <Card
        label="Return %"
        value={`${returnSign} ${Math.abs(returnPct).toFixed(2)}%`}
        sub={`on ₹${(capital / 100000).toFixed(1)}L capital`}
        sub2={`Profit factor: ${profitFactor}`}
      />
      <Card
        label="Portfolio"
        value={`${open.length} open`}
        sub={`${closed.length} closed · ${trades.filter(t => t.status === "QUEUED").length} queued`}
        sub2={`W:L ratio ${rrRatio}`}
      />
    </div>
  );
}