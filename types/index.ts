// ============================================================
// types/index.ts
// Single source of truth for all TypeScript interfaces.
// If more than one file uses a type, it lives here.
// ============================================================

/**
 * What the user types into the calculator form.
 * Used by: CalculatorForm, CalculatorClient, calculations.ts
 */
export interface CalculatorInputs {
  ticker:      string;   // e.g. "RELIANCE.NS"
  stopLoss:    number;   // price at which you exit if wrong
  capital:     number;   // total trading capital (₹)
  riskPercent: number;   // % of capital willing to lose per trade
}

/**
 * The full result returned by calculatePosition().
 * Used by: CalculatorClient, ResultsPanel, ResultCard
 */
export interface CalculationResult {
  entryPrice:      number;  // live price fetched from API
  riskPerShare:    number;  // entryPrice − stopLoss
  maxRiskAmount:   number;  // capital × (riskPercent / 100)
  positionSize:    number;  // floor(maxRiskAmount / riskPerShare)
  capitalRequired: number;  // positionSize × entryPrice
}

/**
 * Response shape from GET /api/stock-price.
 * Discriminated union: either success with price, or failure with error.
 * Used by: app/api/stock-price/route.ts, CalculatorClient
 */
export type StockPriceResponse =
  | { success: true;  ticker: string; price: number }
  | { success: false; error: string };

/**
 * UI state machine for the calculator page.
 * Used by: CalculatorClient
 */
export type AppStatus = "idle" | "loading" | "success" | "error";

/**
 * A single validation error with an optional field reference.
 * Used by: calculations.ts (validateInputs), CalculatorForm
 */
export interface ValidationError {
  message: string;
  field?: keyof CalculatorInputs;  // which field caused the error
}

/**
 * Shape of errors returned from API routes.
 * Used by: all API routes, CalculatorClient fetch handler
 */
export interface ApiError {
  success: false;
  error:   string;
  code?:   number;   // optional HTTP status code
}