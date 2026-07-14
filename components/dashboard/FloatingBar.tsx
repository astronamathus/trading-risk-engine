"use client";

import { Trade } from "@/lib/db/trades";

interface FloatingBarProps {
  trades:        Trade[];
  livePrices:    Record<string, number>;
  capitalLimit?: number;  // from trader_users.capital_limit, passed by dashboard
}

function formatINR(v: number) {
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)}L`;
  if (Math.abs(v) >= 1000)   return `₹${(v / 1000).toFixed(1)}k`;
  return `₹${v.toFixed(0)}`;
}

function Stat({
  label, value, sub, colour = "text-slate-900 dark:text-slate-100", border = true,
}: {
  label: string; value: string; sub?: string;
  colour?: string; border?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 px-5 ${border ? "border-r border-slate-200/60 dark:border-slate-700/60" : ""} shrink-0 min-w-0`}>
      <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap h-4 flex items-center">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${colour}`}>
        {value}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-600 whitespace-nowrap h-4 flex items-center">
        {sub ?? ""}
      </span>
    </div>
  );
}

export default function FloatingBar({ trades, livePrices, capitalLimit }: FloatingBarProps) {
  const open   = trades.filter(t => t.status === "OPEN");
  const closed = trades.filter(
    t => t.status === "CLOSED" || t.status === "STOPPED" || t.status === "TARGET_HIT"
  );

  // Portfolio value (LTP × qty for open trades)
  const portfolioValue = open.reduce((s, t) => {
    const ltp = livePrices[t.ticker];
    return s + (ltp !== undefined ? ltp * t.quantity : t.entry_price * t.quantity);
  }, 0);

  // Unrealised P&L
  const unrealisedPnl = open.reduce((s, t) => {
    const ltp = livePrices[t.ticker];
    return s + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
  }, 0);

  // Realised P&L
  const realisedPnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);

  // Lifetime P&L
  const lifetimePnl = realisedPnl + unrealisedPnl;

  // Total capital at risk across open positions
  const totalRisk = open.reduce((s, t) => s + (t.risk_amount ?? 0), 0);

  // Portfolio risk % = total risk / capital
  // Prefer capitalLimit from org (admin-set); fall back to first trade's capital
  const capital     = capitalLimit ?? open.find(t => t.capital)?.capital ?? 100000;
  const portfolioRiskPct = capital > 0 ? (totalRisk / capital) * 100 : 0;

  // Remaining capital = limit minus current open position cost
  const openCost       = open.reduce((s, t) => s + t.entry_price * t.quantity, 0);
  const remainingCap   = capital - openCost;
  const remainingPct   = capital > 0 ? (remainingCap / capital) * 100 : 0;

  // Average open R: for each open trade, R = unrealised PnL / risk_amount
  const rValues = open
    .map(t => {
      const ltp = livePrices[t.ticker];
      const risk = t.risk_amount;
      if (!risk || risk === 0 || ltp === undefined) return null;
      return (ltp - t.entry_price) * t.quantity / risk;
    })
    .filter((r): r is number => r !== null);

  const avgR = rValues.length > 0
    ? rValues.reduce((s, r) => s + r, 0) / rValues.length
    : null;

  const rSign   = avgR !== null && avgR >= 0 ? "+" : "";
  const rColour = avgR === null ? "text-slate-400 dark:text-slate-500"
    : avgR >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div className="sticky top-0 z-40 w-full">
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
        shadow-2xl shadow-black/40 py-3 flex items-center overflow-x-auto">

        <Stat
          label="Portfolio Value"
          value={formatINR(portfolioValue)}
        />
        <Stat
          label="Lifetime P&L"
          value={`${lifetimePnl >= 0 ? "+" : ""}${formatINR(lifetimePnl)}`}
          sub={`${unrealisedPnl >= 0 ? "+" : ""}${formatINR(unrealisedPnl)} unreal.`}
          colour={lifetimePnl >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <Stat
          label="Portfolio Risk"
          value={`${portfolioRiskPct.toFixed(2)}%`}
          sub={formatINR(totalRisk)}
          colour={
            portfolioRiskPct > 5  ? "text-red-400"
            : portfolioRiskPct > 2 ? "text-amber-400"
            : "text-slate-900 dark:text-slate-100"
          }
        />
        <Stat
          label="Realised P&L"
          value={`${realisedPnl >= 0 ? "+" : ""}${formatINR(realisedPnl)}`}
          colour={realisedPnl >= 0 ? "text-emerald-400" : "text-red-400"}
        />
        <Stat
          label="Open Positions"
          value={`${open.length}`}
          sub={open.length === 1 ? "position" : "positions"}
        />
        <Stat
          label="Remaining Capital"
          value={formatINR(remainingCap)}
          sub={`${remainingPct.toFixed(1)}% of ${formatINR(capital)}`}
          colour={
            remainingPct < 20 ? "text-red-400"
            : remainingPct < 50 ? "text-amber-400"
            : "text-slate-900 dark:text-slate-100"
          }
        />
        <Stat
          label="Avg Open R"
          value={avgR !== null ? `${rSign}${avgR.toFixed(2)}R` : "—"}
          colour={rColour}
          sub={rValues.length > 0 ? `across ${rValues.length} trade${rValues.length > 1 ? "s" : ""}` : undefined}
          border={false}
        />
      </div>
    </div>
  );
}