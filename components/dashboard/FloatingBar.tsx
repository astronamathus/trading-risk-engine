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

  const metrics = (currency: "INR" | "USD") => {
    const poolOpen = open.filter(t => (t.currency ?? marketFromTicker(t.ticker)) === currency);
    const poolClosed = closed.filter(t => (t.currency ?? marketFromTicker(t.ticker)) === currency);
    const value = poolOpen.reduce((sum, t) => sum + (livePrices[t.ticker] ?? t.entry_price) * t.quantity, 0);
    const entryCost = poolOpen.reduce((sum, t) => sum + t.entry_price * t.quantity, 0);
    const mtm = value - entryCost;
    const risk = poolOpen.reduce((sum, t) => sum + (t.risk_amount ?? 0), 0);
    const capital = currency === "INR" ? (capitalLimit ?? poolOpen.find(t => t.capital)?.capital ?? 100000) : (poolOpen.find(t => t.capital)?.capital ?? 10000);
    const remaining = capital - entryCost;
    const expectancy = poolClosed.length ? poolClosed.reduce((sum, t) => sum + (t.realised_pnl ?? 0), 0) / poolClosed.length : null;
    const drawdown = poolOpen.reduce((sum, t) => {
      const ltp = livePrices[t.ticker];
      if (ltp === undefined) return sum;
      const pnl = (ltp - t.entry_price) * t.quantity;
      return pnl < 0 ? sum + pnl : sum;
    }, 0);
    return { value, entryCost, mtm, riskPct: capital > 0 ? risk / capital * 100 : 0, remaining, remainingPct: capital > 0 ? remaining / capital * 100 : 0, expectancy, drawdown, drawdownPct: capital > 0 ? Math.abs(drawdown) / capital * 100 : 0 };
  };
  const inr = metrics("INR");
  const usd = metrics("USD");
  const formatPair = (a: number, b: number) => `INR ${formatINR(a, "INR")} · USD ${formatINR(b, "USD")}`;
  const mtmDisplay = `INR ${inr.mtm >= 0 ? "+" : ""}${formatINR(inr.mtm, "INR")} · USD ${usd.mtm >= 0 ? "+" : ""}${formatINR(usd.mtm, "USD")}`;
  const expectancyDisplay = [inr.expectancy !== null ? `INR ${formatINR(inr.expectancy, "INR")}/trade` : null, usd.expectancy !== null ? `USD ${formatINR(usd.expectancy, "USD")}/trade` : null].filter(Boolean).join(" · ") || "—";
  const remainingDisplay = formatPair(inr.remaining, usd.remaining);
  const drawdownDisplay = [inr.drawdown < 0 ? `INR -${formatINR(Math.abs(inr.drawdown), "INR")} (${inr.drawdownPct.toFixed(1)}%)` : null, usd.drawdown < 0 ? `USD -${formatINR(Math.abs(usd.drawdown), "USD")} (${usd.drawdownPct.toFixed(1)}%)` : null].filter(Boolean).join(" · ") || "—";
  return (
    <div className="sticky top-3 z-40 w-full">
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md
        shadow-2xl shadow-black/40 py-3 flex items-center overflow-x-auto">

        <Stat
          label="Portfolio Value"
          value={formatPair(inr.value, usd.value)}
        />
        <Stat
          label="Mark to Market"
          value={inr.mtm !== 0 || usd.mtm !== 0 ? mtmDisplay : "—"}
          colour={inr.mtm + usd.mtm > 0 ? "text-emerald-400" : inr.mtm + usd.mtm < 0 ? "text-red-400" : "text-slate-900 dark:text-slate-100"}
        />
        <Stat
          label="Portfolio Risk"
          value={`INR ${inr.riskPct.toFixed(2)}% · USD ${usd.riskPct.toFixed(2)}%`}
          colour={
            inr.riskPct > 5 || usd.riskPct > 5 ? "text-red-400"
            : inr.riskPct > 2 || usd.riskPct > 2 ? "text-amber-400"
            : "text-slate-900 dark:text-slate-100"
          }
        />
        <Stat
          label="Expectancy"
          value={expectancyDisplay}
          colour="text-slate-900 dark:text-slate-100"
        />
        <Stat
          label="Open Positions"
          value={`${open.length}`}
        />
        <Stat
          label="Remaining Capital"
          value={remainingDisplay}
          colour={
            inr.remainingPct < 20 || usd.remainingPct < 20 ? "text-red-400"
            : inr.remainingPct < 50 || usd.remainingPct < 50 ? "text-amber-400"
            : "text-slate-900 dark:text-slate-100"
          }
        />
        <Stat
          label="Drawdown"
          value={drawdownDisplay}
          colour={inr.drawdown < 0 || usd.drawdown < 0 ? "text-red-400" : "text-slate-900 dark:text-slate-100"}
          border={false}
        />
      </div>
    </div>
  );
}