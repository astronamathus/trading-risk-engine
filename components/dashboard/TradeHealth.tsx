"use client";

import { Trade } from "@/lib/db/trades";

interface TradeHealthProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

interface HealthRow {
  label:  string;
  count:  number;
  colour: string;
  dot:    string;
  trades: { ticker: string; r: number; pnl: number }[];
}

export default function TradeHealth({ trades, livePrices }: TradeHealthProps) {
  const open = trades.filter(t => t.status === "OPEN");

  // Classify each open trade
  const categorised = open.map(t => {
    const ltp  = livePrices[t.ticker];
    const risk = t.risk_amount ?? 0;
    if (ltp === undefined || risk === 0) return { trade: t, category: "unknown", r: 0, pnl: 0 };

    const pnl        = (ltp - t.entry_price) * t.quantity;
    const r          = pnl / risk;
    const target     = t.entry_price + 2 * (t.entry_price - t.stop_loss);
    const distToSLPct = ((ltp - t.stop_loss) / t.entry_price) * 100;

    let category: string;
    if (ltp >= target)         category = "at_target";
    else if (pnl > 0)          category = "winning";
    else if (distToSLPct < 1)  category = "near_stop"; // within 1% of SL
    else                       category = "losing";

    return { trade: t, category, r, pnl };
  });

  const winning   = categorised.filter(c => c.category === "winning");
  const losing    = categorised.filter(c => c.category === "losing");
  const atTarget  = categorised.filter(c => c.category === "at_target");
  const nearStop  = categorised.filter(c => c.category === "near_stop");
  const unknown   = categorised.filter(c => c.category === "unknown");

  const rows: HealthRow[] = [
    {
      label:  "Winning",
      count:  winning.length,
      colour: "text-emerald-400",
      dot:    "bg-emerald-500",
      trades: winning.map(c => ({ ticker: c.trade.ticker.replace(/\.(NS|BO)$/, ""), r: c.r, pnl: c.pnl })),
    },
    {
      label:  "At Target",
      count:  atTarget.length,
      colour: "text-blue-400",
      dot:    "bg-blue-500",
      trades: atTarget.map(c => ({ ticker: c.trade.ticker.replace(/\.(NS|BO)$/, ""), r: c.r, pnl: c.pnl })),
    },
    {
      label:  "Losing",
      count:  losing.length,
      colour: "text-red-400",
      dot:    "bg-red-500",
      trades: losing.map(c => ({ ticker: c.trade.ticker.replace(/\.(NS|BO)$/, ""), r: c.r, pnl: c.pnl })),
    },
    {
      label:  "Near Stop",
      count:  nearStop.length,
      colour: "text-amber-400",
      dot:    "bg-amber-500",
      trades: nearStop.map(c => ({ ticker: c.trade.ticker.replace(/\.(NS|BO)$/, ""), r: c.r, pnl: c.pnl })),
    },
  ];

  // Win rate across all open positions with live data
  const withData  = categorised.filter(c => c.category !== "unknown");
  const winCount  = winning.length + atTarget.length;
  const winRate   = withData.length > 0
    ? ((winCount / withData.length) * 100).toFixed(0)
    : null;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Open Trade Health</h3>
        {winRate !== null && (
          <span className="text-xs text-slate-500">
            <span className={`font-semibold ${parseInt(winRate) >= 50 ? "text-emerald-400" : "text-red-400"}`}>
              {winRate}%
            </span>
            {" "}winning
          </span>
        )}
      </div>

      {open.length === 0 ? (
        <div className="flex items-center justify-center py-8 text-slate-600 text-sm">
          No open positions.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(row => (
            <div key={row.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${row.dot}`}/>
                  <span className="text-xs text-slate-400">{row.label}</span>
                </div>
                <span className={`text-sm font-semibold ${row.count > 0 ? row.colour : "text-slate-600"}`}>
                  {row.count}
                </span>
              </div>

              {/* Show ticker chips for non-zero rows */}
              {row.count > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-4">
                  {row.trades.map(t => (
                    <span
                      key={t.ticker}
                      className={`text-xs px-2 py-0.5 rounded-full border font-mono
                        ${row.label === "Winning"   ? "border-emerald-800 text-emerald-400 bg-emerald-900/20"
                        : row.label === "At Target" ? "border-blue-800    text-blue-400    bg-blue-900/20"
                        : row.label === "Losing"    ? "border-red-800     text-red-400     bg-red-900/20"
                        :                            "border-amber-800   text-amber-400   bg-amber-900/20"
                      }`}
                    >
                      {t.ticker}
                      <span className="ml-1 opacity-60">
                        {t.r >= 0 ? "+" : ""}{t.r.toFixed(2)}R
                      </span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Loading state for unknown */}
          {unknown.length > 0 && (
            <p className="text-xs text-slate-600 pl-4">
              {unknown.length} trade{unknown.length > 1 ? "s" : ""} awaiting price data…
            </p>
          )}
        </div>
      )}
    </div>
  );
}