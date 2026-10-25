"use client";

import { Trade } from "@/lib/db/trades";
import { formatMoney, marketFromTicker } from "@/lib/currency";

interface FloatingBarProps {
  trades:        Trade[];
  livePrices:    Record<string, number>;
  capitalLimit?: number;
}

function formatINR(v: number, market: "INR" | "USD" = "INR") { return formatMoney(v, market); }

function Stat({
  label, value, colour = "text-slate-900 dark:text-slate-100", border = true,
}: {
  label: string; value: string;
  colour?: string; border?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-1 px-5 ${border ? "border-r border-slate-200/60 dark:border-slate-700/60" : ""} shrink-0 min-w-0`}>
      <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${colour}`}>
        {value}
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

  // Mark to Market: live value vs entry cost of open book
  const openEntryCost = open.reduce((s, t) => s + t.entry_price * t.quantity, 0);
  const mtmPnl        = portfolioValue - openEntryCost;
  const mtmPct        = openEntryCost > 0 ? (mtmPnl / openEntryCost) * 100 : 0;
  const mtmDisplay    = `${mtmPnl >= 0 ? "+" : ""}${formatINR(mtmPnl)} (${mtmPct >= 0 ? "+" : ""}${mtmPct.toFixed(2)}%)`;

  // Total capital at risk across open positions
  const totalRisk = open.reduce((s, t) => s + (t.risk_amount ?? 0), 0);

  // Portfolio risk %
  const capital          = capitalLimit ?? open.find(t => t.capital)?.capital ?? 100000;
  const portfolioRiskPct = capital > 0 ? (totalRisk / capital) * 100 : 0;

  // Remaining capital
  const remainingCap = capital - openEntryCost;
  const remainingPct = capital > 0 ? (remainingCap / capital) * 100 : 0;

  // Expectancy: average P&L per closed trade (truest measure of edge)
  const expectancy = closed.length > 0
    ? closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0) / closed.length
    : null;

  // Drawdown: sum of losing open positions vs entry
  const drawdown = open.reduce((s, t) => {
    const ltp = livePrices[t.ticker];
    if (ltp === undefined) return s;
    const pnl = (ltp - t.entry_price) * t.quantity;
    return pnl < 0 ? s + pnl : s;
  }, 0);
  const drawdownPct = capital > 0 ? (Math.abs(drawdown) / capital) * 100 : 0;

  return (
    <div className="sticky top-3 z-40 w-full">
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
        shadow-2xl shadow-black/40 py-3 flex items-center overflow-x-auto">

        <Stat
          label="Portfolio Value"
          value={formatINR(portfolioValue)}
        />
        <Stat
          label="Mark to Market"
          value={mtmPnl !== 0 ? mtmDisplay : "—"}
          colour={mtmPnl > 0 ? "text-emerald-400" : mtmPnl < 0 ? "text-red-400" : "text-slate-900 dark:text-slate-100"}
        />
        <Stat
          label="Portfolio Risk"
          value={`${portfolioRiskPct.toFixed(2)}%`}
          colour={
            portfolioRiskPct > 5  ? "text-red-400"
            : portfolioRiskPct > 2 ? "text-amber-400"
            : "text-slate-900 dark:text-slate-100"
          }
        />
        <Stat
          label="Expectancy"
          value={expectancy !== null ? `${expectancy >= 0 ? "+" : ""}${formatINR(expectancy)}/trade` : "—"}
          colour={
            expectancy === null ? "text-slate-400 dark:text-slate-500"
            : expectancy >= 0 ? "text-emerald-400" : "text-red-400"
          }
        />
        <Stat
          label="Open Positions"
          value={`${open.length}`}
        />
        <Stat
          label="Remaining Capital"
          value={formatINR(remainingCap)}
          colour={
            remainingPct < 20 ? "text-red-400"
            : remainingPct < 50 ? "text-amber-400"
            : "text-slate-900 dark:text-slate-100"
          }
        />
        <Stat
          label="Drawdown"
          value={drawdown < 0 ? `-${formatINR(Math.abs(drawdown))} (${drawdownPct.toFixed(1)}%)` : "—"}
          colour={drawdown < 0 ? "text-red-400" : "text-slate-900 dark:text-slate-100"}
          border={false}
        />
      </div>
    </div>
  );
}