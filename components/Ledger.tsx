// ============================================================
// components/Ledger.tsx
// Displays all saved trades for the current user.
// Allows marking trades as CLOSED or STOPPED, and deleting.
// ============================================================

"use client";

import { useState } from "react";
import { Trade, updateTradeStatus, deleteTrade } from "@/lib/db/trades";

interface LedgerProps {
  trades:    Trade[];
  onRefresh: () => void;  // parent re-fetches after any mutation
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2,
  }).format(v);
}

function StatusBadge({ status }: { status: Trade["status"] }) {
  const styles = {
    OPEN:    "border-emerald-600 text-emerald-400 bg-emerald-900/20",
    CLOSED:  "border-slate-600  text-slate-400  bg-slate-800/40",
    STOPPED: "border-red-700    text-red-400    bg-red-900/20",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function Ledger({ trades, onRefresh }: LedgerProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleStatus(trade: Trade, status: Trade["status"]) {
    setLoadingId(trade.id);
    try {
      await updateTradeStatus(trade.id, status);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingId(null);
    }
  }

  async function handleDelete(tradeId: string) {
    if (!confirm("Delete this trade from the ledger?")) return;
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
      <div className="flex items-center justify-center py-12 text-center">
        <p className="text-sm text-slate-500 max-w-xs">
          No trades saved yet. Calculate a position and click{" "}
          <span className="text-slate-400 font-medium">Add to Ledger</span> to start tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
            <th className="text-left pb-3 pr-4">Ticker</th>
            <th className="text-right pb-3 pr-4">Entry</th>
            <th className="text-right pb-3 pr-4">Stop Loss</th>
            <th className="text-right pb-3 pr-4">Qty</th>
            <th className="text-right pb-3 pr-4">Risk</th>
            <th className="text-center pb-3 pr-4">Status</th>
            <th className="text-right pb-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {trades.map(trade => {
            const isLoading = loadingId === trade.id;
            return (
              <tr key={trade.id} className={`transition-opacity ${isLoading ? "opacity-40" : ""}`}>
                <td className="py-3 pr-4">
                  <span className="font-mono font-semibold text-slate-200">
                    {trade.ticker}
                  </span>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {new Date(trade.created_at).toLocaleDateString("en-IN")}
                  </div>
                </td>
                <td className="py-3 pr-4 text-right text-slate-300">
                  {formatINR(trade.entry_price)}
                </td>
                <td className="py-3 pr-4 text-right text-slate-400">
                  {formatINR(trade.stop_loss)}
                </td>
                <td className="py-3 pr-4 text-right text-slate-300">
                  {trade.quantity.toLocaleString("en-IN")}
                </td>
                <td className="py-3 pr-4 text-right text-slate-400">
                  {trade.risk_amount ? formatINR(trade.risk_amount) : "—"}
                </td>
                <td className="py-3 pr-4 text-center">
                  <StatusBadge status={trade.status} />
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {trade.status === "OPEN" && (
                      <>
                        <button
                          onClick={() => handleStatus(trade, "CLOSED")}
                          disabled={isLoading}
                          title="Mark as Closed"
                          className="px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200
                            hover:bg-slate-700 transition-colors disabled:opacity-40"
                        >
                          Close
                        </button>
                        <button
                          onClick={() => handleStatus(trade, "STOPPED")}
                          disabled={isLoading}
                          title="Mark as Stopped Out"
                          className="px-2 py-1 rounded text-xs text-red-500 hover:text-red-400
                            hover:bg-red-900/20 transition-colors disabled:opacity-40"
                        >
                          SL Hit
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(trade.id)}
                      disabled={isLoading}
                      title="Delete trade"
                      className="px-2 py-1 rounded text-xs text-slate-600 hover:text-red-400
                        hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}