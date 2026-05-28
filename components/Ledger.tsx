"use client";

import { useState } from "react";
import { Trade, updateTradeStatus, deleteTrade } from "@/lib/db/trades";

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
  const styles = {
    OPEN:    "border-emerald-700 text-emerald-400 bg-emerald-900/20",
    CLOSED:  "border-slate-600  text-slate-400  bg-slate-800/40",
    STOPPED: "border-red-800    text-red-400    bg-red-900/20",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status}
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

function PnlArrow({ profit }: { profit: boolean }) {
  return (
    <svg className="w-3 h-3 inline-block mr-0.5" viewBox="0 0 12 12" fill="currentColor">
      {profit
        ? <path d="M6 2l4 6H2l4-6z"/>
        : <path d="M6 10L2 4h8L6 10z"/>
      }
    </svg>
  );
}

function PnlValue({ trade, ltp, mode, loading }: {
  trade: Trade; ltp: number | undefined; mode: PnlMode; loading: boolean;
}) {
  if (trade.status !== "OPEN") return <span className="text-slate-600">—</span>;
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
      <PnlArrow profit={profit} />{text}
    </span>
  );
}

// ── Expandable detail panel ───────────────────────────────────────────────────

function DetailPanel({
  trade, ltp, onAction,
}: {
  trade:    Trade;
  ltp:      number | undefined;
  onAction: (action: "close" | "stop") => void;
}) {
  // Target = Entry + 2 × (Entry − SL)
  const riskPerShare   = trade.entry_price - trade.stop_loss;
  const target         = trade.entry_price + 2 * riskPerShare;

  // Progress bar: 0 = at SL, 100 = at target, 50 = at entry
  // We map the range [SL → Target] linearly
  const range          = target - trade.stop_loss;  // full range
  const current        = ltp ?? trade.entry_price;
  const raw            = ((current - trade.stop_loss) / range) * 100;
  const progress       = Math.max(0, Math.min(100, raw));
  const entryPct       = ((trade.entry_price - trade.stop_loss) / range) * 100;

  // Is price closer to SL or target?
  const distToSL       = current - trade.stop_loss;
  const distToTarget   = target - current;
  const closerToRisk   = distToSL < distToTarget;

  // Bar colour: green if in profit zone, red if below entry
  const barColour      = current >= trade.entry_price
    ? "bg-emerald-500"
    : "bg-red-500";

  return (
    <td colSpan={7} className="px-4 pb-4 pt-0">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 flex flex-col gap-4 mt-1">

        {/* Key prices row */}
        <div className="grid grid-cols-4 gap-3 text-xs">
          {[
            { label: "Entry",    value: formatINR(trade.entry_price), colour: "text-slate-300" },
            { label: "Stop Loss",value: formatINR(trade.stop_loss),   colour: "text-red-400"   },
            { label: "Target",   value: formatINR(target),            colour: "text-emerald-400"},
            { label: "LTP",      value: ltp ? formatINR(ltp) : "—",  colour: "text-blue-300"  },
          ].map(({ label, value, colour }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <span className="text-slate-500 uppercase tracking-wider">{label}</span>
              <span className={`font-semibold tabular-nums ${colour}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-slate-500">
            <span>SL {formatINR(trade.stop_loss)}</span>
            <span
              className={closerToRisk ? "text-red-400 font-medium" : "text-emerald-400 font-medium"}
            >
              {closerToRisk
                ? `${((distToSL / riskPerShare) * 100).toFixed(1)}% from SL`
                : `${((distToTarget / (2 * riskPerShare)) * 100).toFixed(1)}% from target`
              }
            </span>
            <span>Target {formatINR(target)}</span>
          </div>

          {/* Bar track */}
          <div className="relative h-2 rounded-full bg-slate-700 overflow-hidden">
            {/* Entry marker line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-slate-500 z-10"
              style={{ left: `${entryPct}%` }}
            />
            {/* Fill */}
            <div
              className={`absolute left-0 top-0 bottom-0 rounded-full transition-all duration-500 ${barColour}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-slate-600">
            <span>Stop</span>
            <span className="text-slate-500">Entry ↑</span>
            <span>2R Target</span>
          </div>
        </div>

        {/* Action buttons — only for open trades */}
        {trade.status === "OPEN" && (
          <div className="flex gap-2 pt-1">
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
  const [expandedId, setExpandedId] = useState<string | null>(null); // one open at a time
  const [pnlMode,    setPnlMode]    = useState<PnlMode>("value");

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id);
  }

  async function handleStatus(tradeId: string, status: Trade["status"]) {
    setConfirm(null);
    setExpandedId(null);
    setLoadingId(tradeId);
    try {
      await updateTradeStatus(tradeId, status);
      onRefresh();
    } catch (err) { console.error(err); }
    finally { setLoadingId(null); }
  }

  async function handleDelete(tradeId: string) {
    setConfirm(null);
    setExpandedId(null);
    setLoadingId(tradeId);
    try {
      await deleteTrade(tradeId);
      onRefresh();
    } catch (err) { console.error(err); }
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
            {confirm.action === "delete"   ? "Delete this trade permanently?"
            : confirm.action === "close"   ? "Mark this trade as Closed?"
            :                               "Mark stop loss as hit?"}
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
                else if (confirm.action === "close") handleStatus(confirm.tradeId, "CLOSED");
                else handleStatus(confirm.tradeId, "STOPPED");
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
              <th className="text-right px-4 py-3">LTP</th>
              <th className="text-right px-4 py-3">Risk</th>

              {/* PnL with ₹/% toggle */}
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
              <th className="px-4 py-3" /> {/* bin — no header */}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {trades.map(trade => {
              const busy     = loadingId === trade.id;
              const expanded = expandedId === trade.id;
              const ltp      = livePrices[trade.ticker];

              return (
                <>
                  {/* ── Main row ── */}
                  <tr
                    key={trade.id}
                    onClick={() => !busy && toggleExpand(trade.id)}
                    className={`transition-colors cursor-pointer
                      ${busy ? "opacity-40 pointer-events-none" : ""}
                      ${expanded ? "bg-slate-800/60" : "hover:bg-slate-800/30"}
                    `}
                  >
                    {/* Stock */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {/* Chevron */}
                        <svg
                          className={`w-3.5 h-3.5 text-slate-500 transition-transform shrink-0 ${
                            expanded ? "rotate-90" : ""
                          }`}
                          viewBox="0 0 16 16" fill="none">
                          <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <div>
                          <span className="font-mono font-semibold text-slate-200">
                            {trade.ticker}
                          </span>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {new Date(trade.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Qty */}
                    <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                      {trade.quantity.toLocaleString("en-IN")}
                    </td>

                    {/* LTP */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {trade.status !== "OPEN" ? (
                        <span className="text-slate-600">—</span>
                      ) : pricesLoading && ltp === undefined ? (
                        <span className="text-slate-600 text-xs animate-pulse">…</span>
                      ) : ltp !== undefined ? (
                        <span className="text-slate-300">{formatINR(ltp)}</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* Risk */}
                    <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                      {trade.risk_amount ? formatINR(trade.risk_amount) : "—"}
                    </td>

                    {/* PnL */}
                    <td className="px-4 py-3 text-right">
                      <PnlValue trade={trade} ltp={ltp} mode={pnlMode} loading={pricesLoading} />
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={trade.status} />
                    </td>

                    {/* Bin */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation(); // don't toggle expand
                          setConfirm({ tradeId: trade.id, action: "delete" });
                        }}
                        title="Delete trade"
                        className="p-1.5 rounded-md text-slate-600 hover:text-red-400
                          hover:bg-red-900/20 transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </td>
                  </tr>

                  {/* ── Expanded detail row ── */}
                  {expanded && (
                    <tr key={`${trade.id}-detail`} className="bg-slate-800/20">
                      <DetailPanel
                        trade={trade}
                        ltp={ltp}
                        onAction={action =>
                          setConfirm({ tradeId: trade.id, action })
                        }
                      />
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}