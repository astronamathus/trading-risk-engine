// ============================================================
// lib/calculations.ts
// Pure math. No React. No API calls. Just functions.
// This is your "calculation engine" — easy to test in isolation.
// ============================================================

import { CalculatorInputs, CalculationResult } from "@/types";

/**
 * Validates user inputs before we run calculations.
 * Returns an error message string, or null if inputs are valid.
 *
 * Why separate validation? So the UI can show field-level errors
 * without running any math or API calls.
 */
export function validateInputs(inputs: CalculatorInputs): string | null {
  const { ticker, stopLoss, capital, riskPercent } = inputs;

  if (!ticker.trim()) return "Please enter a stock ticker.";
  if (stopLoss <= 0) return "Stop loss must be greater than zero.";
  if (capital <= 0) return "Capital must be greater than zero.";
  if (riskPercent <= 0 || riskPercent > 100)
    return "Risk percentage must be between 0 and 100.";

  return null; // null = no error = valid
}

/**
 * Core calculation function.
 *
 * Takes validated inputs + the live entry price,
 * returns a complete CalculationResult object.
 *
 * Formula recap:
 *   Risk Per Share   = Entry Price - Stop Loss
 *   Max Risk Amount  = Capital × (Risk% / 100)
 *   Position Size    = Max Risk Amount / Risk Per Share
 *   Capital Required = Position Size × Entry Price
 */
export function calculatePosition(
  inputs: CalculatorInputs,
  entryPrice: number
): CalculationResult {
  const { stopLoss, capital, riskPercent } = inputs;

  const riskPerShare = entryPrice - stopLoss;

  // Edge case: if stop loss >= entry price, the trade makes no sense.
  // We guard this here so the UI never shows nonsense results.
  if (riskPerShare <= 0) {
    throw new Error(
      "Stop loss must be lower than the current market price."
    );
  }

  const maxRiskAmount = capital * (riskPercent / 100);
  const positionSize = maxRiskAmount / riskPerShare;
  const capitalRequired = positionSize * entryPrice;

  // Math.floor on positionSize: you can't buy 12.7 shares.
  // Round down to be conservative (less risk).
  return {
    entryPrice,
    riskPerShare: round(riskPerShare),
    maxRiskAmount: round(maxRiskAmount),
    positionSize: Math.floor(positionSize), // whole shares only
    capitalRequired: round(Math.floor(positionSize) * entryPrice),
  };
}

/**
 * Recalculates position size when capital is capped to a limit.
 * e.g. if limit = ₹10,000 and entry = ₹2,450 → 4 shares max.
 * Returns updated positionSize, actualRisk, and capitalRequired.
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

/**
 * Utility: rounds a number to 2 decimal places.
 * Keeps financial output clean (₹ values).
 */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}