"use client";

import { Trade } from "@/lib/db/trades";

interface FloatingBarProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

function formatINR(v: number, compact = false) {
  if (compact && Math.abs(v) >= 100000) {
    return `₹${(v / 100000).toFixed(2)}L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

interface StatProps {
  label:   string;
  value:   string;
  colour?: string;
  border?: boolean;
}

function Stat({ label, value, colour = "text-slate-100", border = true }: StatProps) {
  return (
    <div className={`flex flex-col gap-0.5 px-4 ${border ? "border-r border-slate-700" : ""}`}>
      <span className="text-xs text-slate-500 uppercase tracking-wider whitespace-nowrap">{label}</span>
      <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${colour}`}>{value}</span>
    </div>
  );
}

export default function FloatingBar({ trades, livePrices }: FloatingBarProps) {
  const open   = trades.filter(t => t.status === "OPEN");
  const queued = trades.filter(t => t.status === "QUEUED");
  const closed = trades.filter(t => t.status === "CLOSED" || t.status === "STOPPED");

  // Live portfolio value
  const portfolioValue = open.reduce((sum, t) => {
    const ltp = livePrices[t.ticker];
    return sum + (ltp !== undefined ? ltp * t.quantity : t.entry_price * t.quantity);
  }, 0);

  // Total capital deployed (entry × qty)
  const deployed = open.reduce((sum, t) => sum + t.entry_price * t.quantity, 0);

  // Unrealised P&L
  const unrealisedPnl = open.reduce((sum, t) => {
    const ltp = livePrices[t.ticker];
    return sum + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
  }, 0);

  // Realised P&L (lifetime)
  const realisedPnl = closed.reduce((sum, t) => sum + (t.realised_pnl ?? 0), 0);

  // Total lifetime P&L
  const lifetimePnl = realisedPnl + unrealisedPnl;

  // Total capital at risk (sum of risk_amount on open trades)
  const capitalAtRisk = open.reduce((sum, t) => sum + (t.risk_amount ?? 0), 0);

  // Largest single position (concentration)
  const largest = open.reduce((max, t) => {
    const ltp = livePrices[t.ticker];
    const val = ltp !== undefined ? ltp * t.quantity : t.entry_price * t.quantity;
    return val > max.val ? { ticker: t.ticker, val } : max;
  }, { ticker: "", val: 0 });

  const pnlColour   = unrealisedPnl >= 0 ? "text-emerald-400" : "text-red-400";
  const lifetimeCol = lifetimePnl   >= 0 ? "text-emerald-400" : "text-red-400";
  const riskColour  = capitalAtRisk > 0   ? "text-amber-400"   : "text-slate-100";

  return (
    <div className="sticky top-0 z-40 mx-auto max-w-5xl">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/90 backdrop-blur
        shadow-xl shadow-black/30 px-2 py-3 flex items-center overflow-x-auto gap-0">

        <Stat label="Portfolio Value"  value={formatINR(portfolioValue, true)} />
        <Stat label="Deployed"         value={formatINR(deployed, true)} />
        <Stat label="Unrealised P&L"   value={`${unrealisedPnl >= 0 ? "+" : ""}${formatINR(unrealisedPnl, true)}`} colour={pnlColour} />
        <Stat label="Lifetime P&L"     value={`${lifetimePnl >= 0 ? "+" : ""}${formatINR(lifetimePnl, true)}`}     colour={lifetimeCol} />
        <Stat label="Capital at Risk"  value={formatINR(capitalAtRisk, true)} colour={riskColour} />
        <Stat label="Positions"        value={`${open.length} open${queued.length > 0 ? ` · ${queued.length} queued` : ""}`} />
        {largest.ticker && (
          <Stat
            label="Largest Position"
            value={`${largest.ticker.replace(/\.(NS|BO)$/, "")} ${formatINR(largest.val, true)}`}
            border={false}
          />
        )}
      </div>
    </div>
  );
}