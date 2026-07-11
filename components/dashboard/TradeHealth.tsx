"use client";

import { useState } from "react";
import { Trade } from "@/lib/db/trades";

interface TradeHealthProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

const CLOSED_STATUSES = ["CLOSED", "STOPPED", "TARGET_HIT"] as const;

function formatINR(v: number) {
  const abs = Math.abs(v);
  const str = abs >= 100000
    ? `₹${(abs / 100000).toFixed(2)}L`
    : `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return v < 0 ? `-${str}` : str;
}

export default function TradeHealth({ trades, livePrices }: TradeHealthProps) {
  const [view, setView] = useState<"open" | "closed">("open");

  const open   = trades.filter(t => t.status === "OPEN");
  const closed = trades.filter(t => (CLOSED_STATUSES as readonly string[]).includes(t.status));

  // ── Open trade health ─────────────────────────────────────
  const categorised = open.map(t => {
    const ltp  = livePrices[t.ticker];
    const risk = t.risk_amount ?? 0;
    if (ltp === undefined || risk === 0) return { trade: t, category: "unknown", r: 0, pnl: 0 };

    const pnl         = (ltp - t.entry_price) * t.quantity;
    const r           = pnl / risk;
    const target      = t.entry_price + 2 * (t.entry_price - t.stop_loss);
    const distToSLPct = ((ltp - t.stop_loss) / t.entry_price) * 100;

    const category =
      ltp >= target       ? "at_target" :
      pnl > 0             ? "winning"   :
      distToSLPct < 1     ? "near_stop" : "losing";

    return { trade: t, category, r, pnl };
  });

  const winning  = categorised.filter(c => c.category === "winning");
  const losing   = categorised.filter(c => c.category === "losing");
  const atTarget = categorised.filter(c => c.category === "at_target");
  const nearStop = categorised.filter(c => c.category === "near_stop");
  const unknown  = categorised.filter(c => c.category === "unknown");

  const withData = categorised.filter(c => c.category !== "unknown");
  const winRate  = withData.length > 0
    ? (((winning.length + atTarget.length) / withData.length) * 100).toFixed(0) : null;

  // ── Closed trade history ───────────────────────────────────
  const recent = [...closed]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const STATUS_STYLE: Record<string, string> = {
    TARGET_HIT: "border-blue-700   text-blue-400   bg-blue-900/20",
    CLOSED:     "border-slate-300 dark:border-slate-600  text-slate-400 dark:text-slate-500 dark:text-slate-400  bg-slate-100/40 dark:bg-white dark:bg-slate-800/40",
    STOPPED:    "border-red-800    text-red-400    bg-red-900/20",
  };
  const STATUS_LABEL: Record<string, string> = {
    TARGET_HIT: "TG HIT", CLOSED: "CLOSED", STOPPED: "SL HIT",
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white dark:bg-slate-800/50 p-5 flex flex-col gap-4">
      {/* Toggle header */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
          <button
            onClick={() => setView("open")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === "open"
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300"
            }`}>
            Open ({open.length})
          </button>
          <button
            onClick={() => setView("closed")}
            className={`px-3 py-1.5 font-medium transition-colors ${
              view === "closed"
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300"
            }`}>
            Closed ({closed.length})
          </button>
        </div>
        {view === "open" && winRate !== null && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            <span className={`font-semibold ${parseInt(winRate) >= 50 ? "text-emerald-400" : "text-red-400"}`}>
              {winRate}%
            </span>{" "}winning
          </span>
        )}
        {view === "closed" && closed.length > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            <span className={`font-semibold ${
              closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0) >= 0
                ? "text-emerald-400" : "text-red-400"
            }`}>
              {closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0) >= 0 ? "+" : ""}
              {formatINR(closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0))}
            </span>{" "}realised
          </span>
        )}
      </div>

      {/* ── Open view ── */}
      {view === "open" && (
        open.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-600 text-sm">
            No open positions.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {[
              { label: "At Target", items: atTarget, dot: "bg-blue-500",    badge: "border-blue-800 text-blue-400 bg-blue-900/20" },
              { label: "Winning",   items: winning,  dot: "bg-emerald-500", badge: "border-emerald-800 text-emerald-400 bg-emerald-900/20" },
              { label: "Near Stop", items: nearStop, dot: "bg-amber-500",   badge: "border-amber-800 text-amber-400 bg-amber-900/20" },
              { label: "Losing",    items: losing,   dot: "bg-red-500",     badge: "border-red-800 text-red-400 bg-red-900/20" },
            ].map(row => (
              <div key={row.label} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${row.dot}`}/>
                    <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">{row.label}</span>
                  </div>
                  <span className={`text-sm font-semibold ${
                    row.items.length > 0 ? row.badge.split(" ")[1] : "text-slate-400 dark:text-slate-600"
                  }`}>
                    {row.items.length}
                  </span>
                </div>
                {row.items.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-4">
                    {row.items.map(c => (
                      <span key={c.trade.ticker}
                        className={`text-xs px-2 py-0.5 rounded-full border font-mono ${row.badge}`}>
                        {c.trade.ticker.replace(/\.(NS|BO)$/, "")}
                        <span className="ml-1 opacity-60">
                          {c.r >= 0 ? "+" : ""}{c.r.toFixed(2)}R
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {unknown.length > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-600 pl-4">
                {unknown.length} trade{unknown.length > 1 ? "s" : ""} awaiting price data…
              </p>
            )}
          </div>
        )
      )}

      {/* ── Closed view ── */}
      {view === "closed" && (
        closed.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400 dark:text-slate-600 text-sm">
            No closed trades yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map(t => {
              const pnl      = t.realised_pnl ?? 0;
              const positive = pnl >= 0;
              const r        = t.risk_amount && t.risk_amount > 0
                ? (pnl / t.risk_amount).toFixed(2) : null;
              return (
                <div key={t.id}
                  className="flex items-center justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-200 dark:border-slate-800/60 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {t.ticker.replace(/\.(NS|BO)$/, "")}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border
                      ${STATUS_STYLE[t.status] ?? STATUS_STYLE.CLOSED}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    {r && (
                      <span className={positive ? "text-emerald-400" : "text-red-400"}>
                        {parseFloat(r) >= 0 ? "+" : ""}{r}R
                      </span>
                    )}
                    <span className={`font-semibold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
                      {positive ? "+" : ""}{formatINR(pnl)}
                    </span>
                  </div>
                </div>
              );
            })}
            {closed.length > 8 && (
              <p className="text-xs text-slate-400 dark:text-slate-600 text-center pt-1">
                Showing last 8 of {closed.length} — see Ledger for full history
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}