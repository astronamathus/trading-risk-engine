"use client";

import { useState } from "react";
import { saveTrade } from "@/lib/db/trades";
import { CalculationResult } from "@/types";

interface SaveToLedgerButtonProps {
  userId:        string | null;
  ticker:        string;
  result:        CalculationResult;
  displayedQty:  number;
  displayedRisk: number;
  totalCapital:  number;
  isQueued:      boolean;   // true when entry > live LTP
  onSaved:       () => void;
}

type ToastState = "idle" | "saving" | "success" | "error";

export default function SaveToLedgerButton({
  userId, ticker, result, displayedQty, displayedRisk,
  totalCapital, isQueued, onSaved,
}: SaveToLedgerButtonProps) {
  const [toast, setToast] = useState<ToastState>("idle");

  async function handleSave() {
    if (!userId) return;
    setToast("saving");
    try {
      await saveTrade({
        user_id:      userId,
        ticker,
        entry_price:  result.entryPrice,
        // entry_target set when queued — this is the price that activates the trade
        entry_target: isQueued ? result.entryPrice : undefined,
        stop_loss:    parseFloat((result.entryPrice - result.riskPerShare).toFixed(2)),
        quantity:     displayedQty,
        risk_amount:  displayedRisk,
        capital:      totalCapital,
        status:       isQueued ? "QUEUED" : "OPEN",
      } as Parameters<typeof saveTrade>[0]);

      setToast("success");
      onSaved();
      setTimeout(() => setToast("idle"), 3000);
    } catch (err) {
      console.error(err);
      setToast("error");
      setTimeout(() => setToast("idle"), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleSave}
        disabled={!userId || toast === "saving"}
        className="
          w-full rounded-lg border border-slate-600 bg-slate-700/60 px-4 py-2.5
          text-sm font-medium text-slate-200 transition-all
          hover:bg-slate-700 hover:border-slate-500
          disabled:opacity-40 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-500
          flex items-center justify-center gap-2
        "
      >
        {toast === "saving" ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Saving…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v8M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            {isQueued ? "Queue Trade" : "Add to Ledger"}
          </>
        )}
      </button>

      {toast === "success" && (
        <p className="text-xs text-center">
          {isQueued
            ? <span className="text-amber-400">🕐 Trade queued — activates when price hits ₹{result.entryPrice.toLocaleString("en-IN")}</span>
            : <span className="text-emerald-400">✓ Trade saved to ledger</span>
          }
        </p>
      )}
      {toast === "error" && (
        <p className="text-xs text-red-400 text-center">✗ Failed to save — try again</p>
      )}
    </div>
  );
}