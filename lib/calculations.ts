// ============================================================
// lib/calculations.ts
// Pure math. No React. No API calls. Just functions.
// All names match types/index.ts and CalculatorClient.tsx exactly.
// ============================================================

import { CalculatorInputs, CalculationResult } from "@/types/index";

// ── Individual formula functions ─────────────────────────────
// Kept separate so each can be unit-tested independently.

/** Entry Price − Stop Loss */
export function calculateRiskPerShare(entryPrice: number, stopLoss: number): number {
  return entryPrice - stopLoss;
}

/** Capital × (Risk% / 100) */
export function calculateMaxRiskAmount(capital: number, riskPercent: number): number {
  return capital * (riskPercent / 100);
}

/** floor(Max Risk Amount / Risk Per Share) — whole shares only */
export function calculatePositionSizeFromRisk(maxRiskAmount: number, riskPerShare: number): number {
  if (riskPerShare <= 0) throw new Error("Risk per share must be greater than zero.");
  return Math.floor(maxRiskAmount / riskPerShare);
}

/** Position Size × Entry Price */
export function calculateCapitalRequired(positionSize: number, entryPrice: number): number {
  return positionSize * entryPrice;
}

// ── Validation ───────────────────────────────────────────────
/**
 * Returns the first validation error as a string, or null if valid.
 * Caller pattern: const err = validateInputs(i); if (err) { ... }
 *
 * Why string | null and not string[]?
 * Our UI shows one error at a time. A single string keeps the
 * caller simple — no array iteration needed.
 */
export function validateInputs(inputs: CalculatorInputs): string | null {
  const { ticker, stopLoss, capital, riskPercent } = inputs;

  if (!ticker.trim())                         return "Please enter a stock ticker.";
  if (stopLoss <= 0)                          return "Stop loss must be greater than zero.";
  if (capital <= 0)                           return "Capital must be greater than zero.";
  if (riskPercent <= 0 || riskPercent > 100)  return "Risk percentage must be between 0 and 100.";

  return null;
}

/**
 * Validates stop loss against the live entry price and risk budget.
 * Called after price is fetched, before calculatePosition.
 */
export function validateStopLoss(
  stopLoss: number,
  entryPrice: number,
  capital: number,
  riskPercent: number
): string | null {
  if (stopLoss >= entryPrice)
    return `Stop loss (₹${stopLoss}) must be below the current price (₹${entryPrice.toFixed(2)}).`;

  const maxRisk    = capital * (riskPercent / 100);
  const riskPerSh  = entryPrice - stopLoss;
  const impliedQty = maxRisk / riskPerSh;

  // If even 1 share's risk exceeds the budget, the stop loss is too tight
  if (riskPerSh > maxRisk)
    return `Stop loss is too close to price — risk per share (₹${riskPerSh.toFixed(2)}) exceeds your max risk budget (₹${maxRisk.toFixed(2)}). Widen your stop loss or increase capital.`;

  return null;
}

// ── Main calculation ─────────────────────────────────────────
/**
 * Takes validated user inputs + live entry price.
 * Returns a complete CalculationResult.
 *
 * Called as: calculatePosition(inputs, data.price)
 * in CalculatorClient.tsx — name and signature must stay stable.
 */
export function calculatePosition(
  inputs: CalculatorInputs,
  entryPrice: number
): CalculationResult {
  const { stopLoss, capital, riskPercent } = inputs;

  const riskPerShare = calculateRiskPerShare(entryPrice, stopLoss);

  if (riskPerShare <= 0) {
    throw new Error("Stop loss must be lower than the current market price.");
  }

  const maxRiskAmount   = calculateMaxRiskAmount(capital, riskPercent);
  const positionSize    = calculatePositionSizeFromRisk(maxRiskAmount, riskPerShare);
  const capitalRequired = round(calculateCapitalRequired(positionSize, entryPrice));

  return {
    entryPrice,          // ← required: ResultsPanel reads result.entryPrice
    riskPerShare:  round(riskPerShare),
    maxRiskAmount: round(maxRiskAmount),
    positionSize,
    capitalRequired,
  };
}

// ── Capital-limited recalculation ────────────────────────────
/**
 * Used by ResultsPanel when mode = "limit".
 * Answers: "if I can only spend ₹X, how many shares can I buy?"
 */
export function recalculateWithCapitalLimit(
  limitCapital: number,
  entryPrice: number,
  riskPerShare: number
): { positionSize: number; actualRisk: number; capitalRequired: number } {
  const positionSize    = Math.floor(limitCapital / entryPrice);
  const actualRisk      = round(positionSize * riskPerShare);
  const capitalRequired = round(positionSize * entryPrice);
  return { positionSize, actualRisk, capitalRequired };
}

// ── Utility ──────────────────────────────────────────────────
function round(value: number): number {
  return Math.round(value * 100) / 100;
}