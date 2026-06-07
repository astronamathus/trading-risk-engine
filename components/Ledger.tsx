"use client";

import { useState } from "react";
import { Trade, updateTradeStatus, deleteTrade, closeTrade } from "@/lib/db/trades";

interface LedgerProps {
  trades:        Trade[];
  livePrices:    Record<string, number>;
  pricesLoading: boolean;
  onRefresh:     () => void;
}

type PnlMode = "value" | "percent";

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(v);
}

function StatusBadge({ status }: { status: Trade["status"] }) {
  const styles: Record<Trade["status"], string> = {
    QUEUED:     "border-amber-700  text-amber-400  bg-amber-900/20",
    OPEN:       "border-emerald-700 text-emerald-400 bg-emerald-900/20",
    CLOSED:     "border-slate-600  text-slate-400  bg-slate-800/40",
    STOPPED:    "border-red-800    text-red-400    bg-red-900/20",
    TARGET_HIT: "border-blue-600   text-blue-400   bg-blue-900/20",
  };
  const labels: Record<Trade["status"], string> = {
    QUEUED: "QUEUED", OPEN: "OPEN", CLOSED: "CLOSED",
    STOPPED: "SL HIT", TARGET_HIT: "TG HIT",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function RiskBadge({ riskPct }: { riskPct: number }) {
  const { label, style } =
    riskPct < 0.5  ? { label: "LOW",    style: "border-emerald-700 text-emerald-400 bg-emerald-900/20" } :
    riskPct <= 1.5 ? { label: "MEDIUM", style: "border-yellow-600  text-yellow-400  bg-yellow-900/20"  } :
                     { label: "HIGH",   style: "border-red-700     text-red-400     bg-red-900/20"     };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${style}`}>
      {label}
    </span>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-3.5 h-3.5 ${spinning ? "animate-spin" : ""}`}
      viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.1-3.3"/>
      <path d="M13.5 2v3h-3"/>
    </svg>
  );
}

function PnlArrow({ profit }: { profit: boolean }) {
  return (
    <svg className="w-3 h-3 inline-block mr-0.5" viewBox="0 0 12 12" fill="currentColor">
      {profit ? <path d="M6 2l4 6H2l4-6z"/> : <path d="M6 10L2 4h8L6 10z"/>}
    </svg>
  );
}

// Handles both unrealised (OPEN) and realised (CLOSED/STOPPED) PnL
function PnlValue({ trade, ltp, mode, loading }: {
  trade: Trade; ltp: number | undefined; mode: PnlMode; loading: boolean;
}) {
  // Closed/Stopped → show realised PnL stored in DB
  if (trade.status !== "OPEN") {
    if (!trade.realised_pnl && trade.realised_pnl !== 0)
      return <span className="text-slate-600">—</span>;
    const profit = trade.realised_pnl >= 0;
    const colour = profit ? "text-emerald-400" : "text-red-400";
    const pct    = trade.entry_price > 0
      ? (trade.realised_pnl / (trade.entry_price * trade.quantity)) * 100
      : 0;
    const text = mode === "value"
      ? `${profit ? "+" : ""}${formatINR(trade.realised_pnl)}`
      : `${profit ? "+" : ""}${pct.toFixed(2)}%`;
    return (
      <span className={`${colour} font-medium tabular-nums`}>
        <PnlArrow profit={profit}/>{text}
        <span className="text-slate-600 text-xs ml-1">R</span>
      </span>
    );
  }

  // Open → show unrealised PnL from live price
  if (loading && ltp === undefined)
    return <span className="text-slate-600 text-xs animate-pulse">…</span>;
  if (ltp === undefined) return <span className="text-slate-600">—</span>;

  const diff   = ltp - trade.entry_price;
  const pnlVal = diff * trade.quantity;
  const pnlPct = (diff / trade.entry_price) * 100;
  const profit = diff >= 0;
  const colour = profit ? "text-emerald-400" : "text-red-400";
  const text   = mode === "value"
    ? `${profit ? "+" : ""}${formatINR(pnlVal)}`
    : `${profit ? "+" : ""}${pnlPct.toFixed(2)}%`;
  return (
    <span className={`${colour} font-medium tabular-nums`}>
      <PnlArrow profit={profit}/>{text}
    </span>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function DetailPanel({ trade, ltp, onAction }: {
  trade: Trade; ltp: number | undefined;
  onAction: (action: "close" | "stop") => void;
}) {
  const riskPerShare = trade.entry_price - trade.stop_loss;
  const target       = trade.entry_price + 2 * riskPerShare;
  const current      = ltp ?? trade.entry_price;
  const range        = target - trade.stop_loss;
  const entryPct     = (riskPerShare / range) * 100; // always 33.33%
  const raw          = ((current - trade.stop_loss) / range) * 100;
  const progress     = Math.max(0, Math.min(100, raw));
  const barColour    = current >= trade.entry_price ? "bg-emerald-500" : "bg-red-500";

  const atEntry    = Math.abs(current - trade.entry_price) < 0.01;
  const aboveEntry = current > trade.entry_price;
  const toPctTarget = ((current - trade.entry_price) / (target - trade.entry_price)) * 100;
  const toPctSL     = ((trade.entry_price - current) / riskPerShare) * 100;

  const progressLabel =
    atEntry    ? "Breakeven" :
    aboveEntry ? `${toPctTarget.toFixed(1)}% to Target` :
                 `${toPctSL.toFixed(1)}% to Stop Loss`;

  const progressColour =
    atEntry    ? "text-slate-400" :
    aboveEntry ? "text-emerald-400" : "text-red-400";

  const capital      = trade.capital ?? 100000;
  const riskPct      = trade.risk_amount ? (trade.risk_amount / capital) * 100 : 0;
  const unrealisedPnl = ltp !== undefined && trade.status === "OPEN"
    ? (ltp - trade.entry_price) * trade.quantity : null;
  const pnlPositive  = unrealisedPnl !== null && unrealisedPnl >= 0;

  const daysHeld = Math.floor(
    (Date.now() - new Date(trade.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  // For closed trades, show exit price; for open, show LTP
  const priceLabel = trade.status === "OPEN" ? "LTP" : "Exit";
  const priceValue = trade.status === "OPEN"
    ? (ltp ? formatINR(ltp) : "—")
    : (trade.exit_price ? formatINR(trade.exit_price) : "—");
  const priceColour = trade.status === "OPEN" ? "text-blue-300" : "text-amber-300";

  return (
    <td colSpan={9} className="px-4 pb-4 pt-0">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 flex flex-col gap-4 mt-1">

        {/* Key prices */}
        <div className="grid grid-cols-5 gap-3 text-xs">
          {[
            { label: "Entry",     value: formatINR(trade.entry_price), colour: "text-slate-300"   },
            { label: "Stop Loss", value: formatINR(trade.stop_loss),   colour: "text-red-400"     },
            { label: "Target",    value: formatINR(target),            colour: "text-emerald-400" },
            { label: priceLabel,  value: priceValue,                   colour: priceColour        },
            { label: "R:R",       value: "1 : 2",                      colour: "text-slate-300"   },
          ].map(({ label, value, colour }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-slate-500 uppercase tracking-wider">{label}</span>
              <span className={`font-semibold tabular-nums ${colour}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Progress bar — only meaningful for open trades */}
        {trade.status === "OPEN" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600">Stop Loss</span>
              <span className={`font-medium ${progressColour}`}>{progressLabel}</span>
              <span className="text-slate-600">Target</span>
            </div>
            <div className="relative h-2 rounded-full bg-slate-700 overflow-visible">
              <div
                className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500 ${barColour}`}
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-400 rounded-full z-10"
                style={{ left: `calc(${entryPct}% - 1px)` }}
              />
            </div>
            <div className="relative h-3 text-xs text-slate-500">
              <span className="absolute -translate-x-1/2" style={{ left: `${entryPct}%` }}>
                Entry
              </span>
            </div>
          </div>
        )}

        {/* Closed: show realised PnL summary instead of progress bar */}
        {trade.status !== "OPEN" && trade.realised_pnl !== null && (
          <div className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-xs">
            <span className="text-slate-500 uppercase tracking-wider">Realised PnL</span>
            <div className={`text-lg font-bold mt-0.5 tabular-nums ${
              trade.realised_pnl >= 0 ? "text-emerald-400" : "text-red-400"
            }`}>
              <PnlArrow profit={trade.realised_pnl >= 0}/>
              {trade.realised_pnl >= 0 ? "+" : ""}{formatINR(trade.realised_pnl)}
            </div>
          </div>
        )}

        {/* Risk + Unrealised PnL + Days Held */}
        <div className="flex items-center gap-3 text-xs border-t border-slate-800 pt-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase tracking-wider">Risk</span>
            <RiskBadge riskPct={riskPct}/>
            <span className="text-slate-600">({riskPct.toFixed(2)}%)</span>
          </div>
          <div className="w-px h-4 bg-slate-700"/>
          {trade.status === "OPEN" && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase tracking-wider">Unrealised PnL</span>
                {unrealisedPnl !== null ? (
                  <span className={`font-semibold tabular-nums ${pnlPositive ? "text-emerald-400" : "text-red-400"}`}>
                    <PnlArrow profit={pnlPositive}/>
                    {pnlPositive ? "+" : ""}{formatINR(unrealisedPnl)}
                  </span>
                ) : <span className="text-slate-600">—</span>}
              </div>
              <div className="w-px h-4 bg-slate-700"/>
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase tracking-wider">Days Held</span>
            <span className="font-semibold text-slate-300">
              {daysHeld === 0 ? "Today" : `${daysHeld}d`}
            </span>
          </div>
        </div>

        {/* Action buttons — open trades only */}
        {trade.status === "OPEN" && (
          <div className="flex gap-2">
            <button
              onClick={() => onAction("stop")}
              className="flex-1 rounded-lg border border-red-800 bg-red-900/20 px-3 py-1.5
                text-xs font-medium text-red-400 hover:bg-red-900/40 transition-colors"
            >
              SL Hit
            </button>
            <button
              onClick={() => onAction("close")}
              className="flex-1 rounded-lg border border-slate-600 bg-slate-700/40 px-3 py-1.5
                text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              Close Trade
            </button>
          </div>
        )}
      </div>
    </td>
  );
}

// ── Confirm bar ───────────────────────────────────────────────────────────────
interface ConfirmState { tradeId: string; action: "delete" | "close" | "stop"; }

// ── Main component ────────────────────────────────────────────────────────────
export default function Ledger({ trades, livePrices, pricesLoading, onRefresh }: LedgerProps) {
  const [loadingId,  setLoadingId]  = useState<string | null>(null);
  const [confirm,    setConfirm]    = useState<ConfirmState | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pnlMode,    setPnlMode]    = useState<PnlMode>("value");
  const [refreshing, setRefreshing] = useState(false);

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 600);
  }

  // Fetches live price then writes exit_price + realised_pnl + status
  async function handleClose(tradeId: string, status: "CLOSED" | "STOPPED" | "TARGET_HIT") {
    setConfirm(null);
    setExpandedId(null);
    setLoadingId(tradeId);

    const trade = trades.find(t => t.id === tradeId);
    if (!trade) { setLoadingId(null); return; }

    try {
      const res       = await fetch(`/api/search-stocks?ticker=${encodeURIComponent(trade.ticker)}`);
      const data      = await res.json();
      const exitPrice = data.success
        ? (data.price as number)
        : (livePrices[trade.ticker] ?? trade.entry_price); // fallback to cached or entry

      await closeTrade(tradeId, status, exitPrice, trade.quantity, trade.entry_price);
      onRefresh();
    } catch (err) {
      console.error("Close trade error:", err);
      // Last resort: just update the status without exit price
      try { await updateTradeStatus(tradeId, status); onRefresh(); }
      catch (e) { console.error(e); }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(tradeId: string) {
    setConfirm(null);
    setExpandedId(null);
    setLoadingId(tradeId);
    try { await deleteTrade(tradeId); onRefresh(); }
    catch (err) { console.error(err); }
    finally { setLoadingId(null); }
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
        <p className="text-slate-500 text-sm">No trades saved yet.</p>
        <p className="text-slate-600 text-xs">
          Calculate a position and click <span className="text-slate-400">Add to Ledger</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Confirm overlay */}
      {confirm && (
        <div className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3
          flex items-center justify-between gap-4 text-sm">
          <span className="text-slate-300">
            {confirm.action === "delete" ? "Delete this trade permanently?"
            : confirm.action === "close" ? "Close trade at live price?"
            :                             "Mark stop loss as hit at live price?"}
          </span>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setConfirm(null)}
              className="px-3 py-1 rounded-lg text-xs text-slate-400 border border-slate-600
                hover:bg-slate-700 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirm.action === "delete") handleDelete(confirm.tradeId);
                else if (confirm.action === "close") handleClose(confirm.tradeId, "CLOSED");
                else handleClose(confirm.tradeId, "STOPPED");
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                confirm.action === "delete"
                  ? "bg-red-700 hover:bg-red-600 text-white"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}>
              Confirm
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/80">
            <tr className="text-xs uppercase tracking-wider text-slate-500">
              <th className="text-left px-4 py-3">Stock</th>
              <th className="text-right px-4 py-3">Qty</th>
              <th className="text-right px-4 py-3">Entry</th>
              <th className="text-right px-4 py-3">LTP</th>
              <th className="text-right px-4 py-3">Value</th>
              <th className="text-right px-4 py-3">Risk</th>
              <th className="text-right px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <span>PnL</span>
                  <div className="flex rounded-md overflow-hidden border border-slate-700 ml-1">
                    <button onClick={() => setPnlMode("value")}
                      className={`px-1.5 py-0.5 text-xs transition-colors ${
                        pnlMode === "value"
                          ? "bg-slate-600 text-slate-200"
                          : "text-slate-600 hover:text-slate-400"
                      }`}>₹</button>
                    <button onClick={() => setPnlMode("percent")}
                      className={`px-1.5 py-0.5 text-xs transition-colors ${
                        pnlMode === "percent"
                          ? "bg-slate-600 text-slate-200"
                          : "text-slate-600 hover:text-slate-400"
                      }`}>%</button>
                  </div>
                </div>
              </th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title="Refresh prices"
                  className="p-1.5 rounded-md text-slate-500 hover:text-slate-300
                    hover:bg-slate-700 transition-colors disabled:opacity-40"
                >
                  <RefreshIcon spinning={refreshing}/>
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {trades.map(trade => {
              const busy     = loadingId === trade.id;
              const expanded = expandedId === trade.id;
              const ltp      = livePrices[trade.ticker];
              const value    = ltp !== undefined && trade.status === "OPEN"
                ? ltp * trade.quantity : null;

              return [
                <tr
                  key={trade.id}
                  onClick={() => !busy && toggleExpand(trade.id)}
                  className={[
                    "transition-colors cursor-pointer",
                    busy     ? "opacity-40 pointer-events-none" : "",
                    expanded ? "bg-slate-800/60" : "hover:bg-slate-800/30",
                  ].join(" ")}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <svg
                        className={`w-3.5 h-3.5 text-slate-500 transition-transform shrink-0 ${expanded ? "rotate-90" : ""}`}
                        viewBox="0 0 16 16" fill="none">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <div>
                        <span className="font-mono font-semibold text-slate-200">{trade.ticker}</span>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {new Date(trade.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                    {trade.quantity.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                    {formatINR(trade.entry_price)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {trade.status === "QUEUED" ? (
                      // Show LTP + distance to entry for queued trades
                      ltp !== undefined ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-slate-400 text-xs">{formatINR(ltp)}</span>
                          <span className="text-amber-400 text-xs">
                            {((trade.entry_price - ltp) / ltp * 100).toFixed(2)}% away
                          </span>
                        </div>
                      ) : <span className="text-slate-600">—</span>
                    ) : trade.status !== "OPEN" ? (
                      <span className="text-slate-600">—</span>
                    ) : pricesLoading && ltp === undefined ? (
                      <span className="text-slate-600 text-xs animate-pulse">…</span>
                    ) : ltp !== undefined ? (
                      <span className="text-slate-300">{formatINR(ltp)}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                    {value !== null ? formatINR(value) : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                    {trade.risk_amount ? formatINR(trade.risk_amount) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PnlValue trade={trade} ltp={ltp} mode={pnlMode} loading={pricesLoading}/>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={trade.status}/>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setConfirm({ tradeId: trade.id, action: "delete" });
                      }}
                      title="Delete trade"
                      className="p-1.5 rounded-md text-slate-600 hover:text-red-400
                        hover:bg-red-900/20 transition-colors"
                    >
                      <TrashIcon/>
                    </button>
                  </td>
                </tr>,

                expanded ? (
                  <tr key={`${trade.id}-detail`} className="bg-slate-800/20">
                    <DetailPanel
                      trade={trade}
                      ltp={ltp}
                      onAction={action => setConfirm({ tradeId: trade.id, action })}
                    />
                  </tr>
                ) : null,
              ];
            })}
          </tbody>

          {/* Portfolio value footer */}
          {(() => {
            const openTrades   = trades.filter(t => t.status === "OPEN");
            const totalValue   = openTrades.reduce((sum, t) => {
              const ltp = livePrices[t.ticker];
              return sum + (ltp !== undefined ? ltp * t.quantity : t.entry_price * t.quantity);
            }, 0);
            const totalRisk    = openTrades.reduce((sum, t) =>
              sum + (t.risk_amount ?? 0), 0);
            const totalPnl     = openTrades.reduce((sum, t) => {
              const ltp = livePrices[t.ticker];
              return sum + (ltp !== undefined ? (ltp - t.entry_price) * t.quantity : 0);
            }, 0);
            const pnlPositive  = totalPnl >= 0;

            return (
              <tfoot className="border-t border-slate-700 bg-slate-800/60">
                <tr className="text-xs text-slate-400">
                  <td className="px-4 py-3 font-medium text-slate-300">
                    Portfolio
                    <div className="text-slate-600 font-normal">{openTrades.length} open positions</div>
                  </td>
                  <td colSpan={2} className="px-4 py-3" />
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-200">
                    {formatINR(totalValue)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                    {formatINR(totalRisk)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    <span className={pnlPositive ? "text-emerald-400" : "text-red-400"}>
                      <PnlArrow profit={pnlPositive}/>
                      {pnlPositive ? "+" : ""}{formatINR(totalPnl)}
                    </span>
                  </td>
                  <td colSpan={3} className="px-4 py-3" />
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}