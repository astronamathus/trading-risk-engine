// ============================================================
// components/Ledger.tsx
// Trade table with status controls and trash-icon delete.
// ============================================================

"use client";

import { useState } from "react";
import { Trade, updateTradeStatus, deleteTrade } from "@/lib/db/trades";

interface LedgerProps {
  trades:    Trade[];
  onRefresh: () => void;
}

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

// Minimal trash icon SVG
function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
    </svg>
  );
}

// Confirmation dialog state per row
interface ConfirmState {
  tradeId: string;
  action:  "delete" | "close" | "stop";
}

export default function Ledger({ trades, onRefresh }: LedgerProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirm,   setConfirm]   = useState<ConfirmState | null>(null);

  async function handleStatus(tradeId: string, status: Trade["status"]) {
    setConfirm(null);
    setLoadingId(tradeId);
    try {
      await updateTradeStatus(tradeId, status);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(tradeId: string) {
    setConfirm(null);
    setLoadingId(tradeId);
    try {
      await deleteTrade(tradeId);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
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
            {confirm.action === "delete"
              ? "Delete this trade permanently?"
              : confirm.action === "close"
                ? "Mark this trade as Closed?"
                : "Mark stop loss as hit?"}
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirm(null)}
              className="px-3 py-1 rounded-lg text-xs text-slate-400 border border-slate-600
                hover:bg-slate-700 transition-colors"
            >
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
              }`}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Table — scrollable on mobile */}
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-700 bg-slate-800/80">
            <tr className="text-xs uppercase tracking-wider text-slate-500">
              <th className="text-left px-4 py-3">Ticker</th>
              <th className="text-right px-4 py-3">Entry</th>
              <th className="text-right px-4 py-3">Stop Loss</th>
              <th className="text-right px-4 py-3">Qty</th>
              <th className="text-right px-4 py-3">Value</th>
              <th className="text-center px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {trades.map(trade => {
              const busy = loadingId === trade.id;
              return (
                <tr
                  key={trade.id}
                  className={`transition-opacity hover:bg-slate-800/30 ${busy ? "opacity-40 pointer-events-none" : ""}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-slate-200">
                      {trade.ticker}
                    </span>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {new Date(trade.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                    {formatINR(trade.entry_price)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-400 tabular-nums">
                    {formatINR(trade.stop_loss)}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                    {trade.quantity.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 tabular-nums">
                    {formatINR(trade.entry_price * trade.quantity)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={trade.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {trade.status === "OPEN" && (
                        <>
                          <button
                            onClick={() => setConfirm({ tradeId: trade.id, action: "close" })}
                            className="px-2 py-1 rounded-md text-xs text-slate-400
                              hover:text-slate-200 hover:bg-slate-700 transition-colors"
                          >
                            Close
                          </button>
                          <button
                            onClick={() => setConfirm({ tradeId: trade.id, action: "stop" })}
                            className="px-2 py-1 rounded-md text-xs text-red-500
                              hover:text-red-400 hover:bg-red-900/20 transition-colors"
                          >
                            SL Hit
                          </button>
                        </>
                      )}
                      {/* Trash icon delete button */}
                      <button
                        onClick={() => setConfirm({ tradeId: trade.id, action: "delete" })}
                        title="Delete trade"
                        className="p-1.5 rounded-md text-slate-600 hover:text-red-400
                          hover:bg-red-900/20 transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}