"use client";

import { useState } from "react";
import { saveTrade } from "@/lib/db/trades";
import { CalculationResult } from "@/types";
import { formatMoney, marketFromTicker } from "@/lib/currency";

interface SaveToLedgerButtonProps {
  userId:            string | null;
  ticker:            string;
  result:            CalculationResult;
  displayedQty:      number;
  displayedRisk:     number;
  displayedCapReq:   number;          // capital required for this trade
  availableCapital:  number | null;   // capital limit minus currently deployed
  totalCapital:      number;
  isQueued:          boolean;
  onSaved:           () => void;
}

type ToastState = "idle" | "saving" | "success" | "error" | "insufficient";

function formatINR(v: number, ticker: string) { return formatMoney(v, marketFromTicker(ticker)); }

export default function SaveToLedgerButton({
  userId, ticker, result, displayedQty, displayedRisk,
  displayedCapReq, availableCapital, totalCapital, isQueued, onSaved,
}: SaveToLedgerButtonProps) {
  const [toast, setToast] = useState<ToastState>("idle");

  // Check funds — only block if we actually have a capital figure loaded.
  // Queued trades don't deploy capital immediately so we allow them through.
  const insufficient =
    !isQueued &&
    availableCapital !== null &&
    displayedCapReq > 0 &&
    displayedCapReq > availableCapital;

  // Not signed in — show a sign-in prompt instead of a broken disabled button
  if (!userId) {
    return (
      <div className="flex flex-col gap-2">
        <a href="/auth"
          className="w-full rounded-lg border border-blue-500 bg-blue-600 px-4 py-2.5
            text-sm font-semibold text-white hover:bg-blue-500 transition-colors
            flex items-center justify-center gap-2">
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>
            <path d="M10 5l3 3-3 3M13 8H6"/>
          </svg>
          Sign in to save trades
        </a>
        <p className="text-xs text-center text-slate-400 dark:text-slate-500">
          Create a free account to track your trades
        </p>
      </div>
    );
  }

  async function handleSave() {
    if (insufficient) {
      setToast("insufficient");
      setTimeout(() => setToast("idle"), 4000);
      return;
    }

    setToast("saving");
    try {
      await saveTrade({
        user_id:      userId,
        ticker,
        entry_price:  result.entryPrice,
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
      {/* Insufficient funds warning banner — shown above button when blocked */}
      {insufficient && (
        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20
          px-3 py-2.5 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">
            Insufficient capital
          </p>
          <p className="text-xs text-red-500 dark:text-red-500">
            This trade requires {formatINR(displayedCapReq, ticker)} but you only have{" "}
            {formatINR(availableCapital!, ticker)} available
            {availableCapital! < 0 ? " (capital fully deployed)" : ""}.
          </p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!userId || toast === "saving"}
        className={`
          w-full rounded-lg border px-4 py-2.5
          text-sm font-medium transition-all
          disabled:opacity-40 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-500
          flex items-center justify-center gap-2
          ${insufficient
            ? "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 cursor-not-allowed opacity-70"
            : "border-slate-300 dark:border-slate-600 bg-slate-100/60 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 hover:border-slate-400 dark:hover:border-slate-500"
          }
        `}
      >
        {toast === "saving" ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Saving…
          </>
        ) : insufficient ? (
          <>
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.5"/>
              <path d="M8 5v3.5M8 11h.01"/>
            </svg>
            Insufficient Capital
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
          {isQueued ? (
            <span className="text-amber-400 flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="6.5"/>
                <path d="M8 4.5V8l2.5 2"/>
              </svg>
              Trade queued — activates when price hits {formatMoney(result.entryPrice, marketFromTicker(ticker))}
            </span>
          ) : (
            <span className="text-emerald-400">✓ Trade saved to ledger</span>
          )}
        </p>
      )}
      {toast === "error" && (
        <p className="text-xs text-red-400 text-center">✗ Failed to save — try again</p>
      )}
      {toast === "insufficient" && (
        <p className="text-xs text-red-500 text-center">
          ✗ Trade blocked — capital required exceeds available funds
        </p>
      )}

      {/* Always show remaining capital when loaded and not in error state */}
      {availableCapital !== null && toast === "idle" && (
        <p className={`text-xs text-center tabular-nums ${
          availableCapital <= 0
            ? "text-red-500 dark:text-red-400"
            : insufficient
              ? "text-red-500 dark:text-red-400"
              : "text-slate-400 dark:text-slate-500"
        }`}>
          {availableCapital <= 0
            ? "No capital available"
            : `${formatINR(availableCapital)} available`}
        </p>
      )}
    </div>
  );
}