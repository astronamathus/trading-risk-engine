"use client";

import { Trade } from "@/lib/db/trades";
import { formatMoney, marketFromTicker } from "@/lib/currency";

interface SummaryCardsProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

const CLOSED_STATUSES = ["CLOSED", "STOPPED", "TARGET_HIT"] as const;

function fmt(v: number, currency: "INR" | "USD" = "INR"): string {
  const abs = formatMoney(Math.abs(v), currency);
  return v > 0 ? `+ ${abs}` : v < 0 ? `- ${abs}` : abs;
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

  const realisedPnl   = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
  const unrealisedPnl = open.reduce((s, t) => {
    const ltp = livePrices[t.ticker];
    return s + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
  }, 0);
  const totalPnl = realisedPnl + unrealisedPnl;

  const pnlFor = (currency: "INR" | "USD") => {
    const poolClosed = closed.filter(t => (t.currency ?? marketFromTicker(t.ticker)) === currency);
    const poolOpen = open.filter(t => (t.currency ?? marketFromTicker(t.ticker)) === currency);
    const realised = poolClosed.reduce((sum, t) => sum + (t.realised_pnl ?? 0), 0);
    const unrealised = poolOpen.reduce((sum, t) => { const ltp = livePrices[t.ticker]; return sum + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0); }, 0);
    return { realised, unrealised, total: realised + unrealised };
  };
  const inrPnl = pnlFor("INR");
  const usdPnl = pnlFor("USD");
  const pnlPair = (field: "total" | "realised" | "unrealised") => `INR ${fmt(inrPnl[field], "INR")} · USD ${fmt(usdPnl[field], "USD")}`;

  const winRate = closed.length > 0
    ? ((winners.length / closed.length) * 100).toFixed(0) : "—";

  const ratioFor = (currency: "INR" | "USD") => {
    const poolWinners = winners.filter(t => (t.currency ?? marketFromTicker(t.ticker)) === currency);
    const poolLosers = losers.filter(t => (t.currency ?? marketFromTicker(t.ticker)) === currency);
    const avgWin = poolWinners.length ? poolWinners.reduce((sum, t) => sum + (t.realised_pnl ?? 0), 0) / poolWinners.length : 0;
    const avgLoss = poolLosers.length ? Math.abs(poolLosers.reduce((sum, t) => sum + (t.realised_pnl ?? 0), 0) / poolLosers.length) : 0;
    return avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : "—";
  };
  const rrRatio = `INR ${ratioFor("INR")} · USD ${ratioFor("USD")}`;




  // Profit factor
  const grossWin  = winners.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.realised_pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—";

  // Per-trade returns as % of capital for Sharpe / Sortino
  // We treat each closed trade's P&L as a "period return" relative to capital.
  const tradeReturns = closed
    .filter(t => (t.risk_amount ?? 0) > 0)
    .map(t => ((t.realised_pnl ?? 0) / (t.capital ?? (marketFromTicker(t.ticker) === "INR" ? 100000 : 10000))) * 100);

  const n = tradeReturns.length;
  const meanReturn = n > 0 ? tradeReturns.reduce((s, r) => s + r, 0) / n : 0;

  // Sharpe: mean / std dev (risk-free rate = 0, intra-portfolio)
  const variance = n > 1
    ? tradeReturns.reduce((s, r) => s + (r - meanReturn) ** 2, 0) / (n - 1) : 0;
  const stdDev   = Math.sqrt(variance);
  const sharpe   = stdDev > 0 ? meanReturn / stdDev : null;

  // Sortino: mean / downside deviation (only negative returns)
  const negReturns      = tradeReturns.filter(r => r < 0);
  const downsideVar     = negReturns.length > 0
    ? negReturns.reduce((s, r) => s + r ** 2, 0) / negReturns.length : 0;
  const downsideDev     = Math.sqrt(downsideVar);
  const sortino         = downsideDev > 0 ? meanReturn / downsideDev : null;

  function fmtRatio(v: number | null): string {
    if (v === null) return "—";
    return (v >= 0 ? "+ " : "- ") + Math.abs(v).toFixed(2);
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <Card
        label="Total P&L"
        value={pnlPair("total")}
        sub={`${pnlPair("realised")} realised`}
        sub2={`${pnlPair("unrealised")} open`}
      />
      <Card
        label="Win Rate"
        value={winRate === "—" ? "—" : `${winRate}%`}
        sub={`${winners.length}W · ${losers.length}L · ${breakeven.length}B`}
        sub2={`of ${closed.length} closed`}
      />
      <Card
        label="W:L Ratio"
        value={rrRatio}
        sub="Average win ÷ average loss within each currency pool"
      />
      <Card
        label="Sharpe Ratio"
        value={fmtRatio(sharpe)}
        sub={n >= 2 ? `across ${n} trades` : "Need 2+ trades"}
      />
      <Card
        label="Sortino Ratio"
        value={fmtRatio(sortino)}
        sub={negReturns.length > 0 ? `${negReturns.length} losing trades` : "No losing trades"}
      />
    </div>
  );
}