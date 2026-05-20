// ============================================================
// types/index.ts
// Central home for all TypeScript interfaces.
// Rule: if more than one file uses a type, it lives here.
// ============================================================

/**
 * What the user types into the calculator form.
 */
export interface CalculatorInputs {
  ticker: string;        // e.g. "RELIANCE" or "TCS"
  stopLoss: number;      // Price at which you'll exit if wrong
  capital: number;       // Total capital available (₹)
  riskPercent: number;   // How much % of capital you're willing to lose
}

/**
 * The calculated results shown to the user.
 */
export interface CalculationResult {
  entryPrice: number;       // Fetched live from API
  riskPerShare: number;     // Entry - Stop Loss
  maxRiskAmount: number;    // Capital × (Risk% / 100)
  positionSize: number;     // Max Risk / Risk Per Share (number of shares)
  capitalRequired: number;  // Position Size × Entry Price
}

/**
 * Shape of the response from our internal API route.
 * Using a discriminated union: either success or error.
 */
export type StockPriceResponse =
  | { success: true; ticker: string; price: number }
  | { success: false; error: string };

/**
 * UI state for the calculator page.
 * Tracks what the component is currently doing.
 */
export type AppStatus = "idle" | "loading" | "success" | "error";