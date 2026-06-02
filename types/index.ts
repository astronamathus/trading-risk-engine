// ============================================================
// types/index.ts
// Single source of truth for all TypeScript interfaces.
// If more than one file uses a type, it lives here.
// ============================================================
// ============================================================
// types/index.ts
// ============================================================

export interface CalculatorInputs {
  ticker:      string;
  stopLoss:    number;
  capital:     number;
  riskPercent: number;
  entryPrice:  number;  // user-set entry, may differ from live LTP
}

export interface CalculationResult {
  entryPrice:      number;
  riskPerShare:    number;
  maxRiskAmount:   number;
  positionSize:    number;
  capitalRequired: number;
}

export type StockPriceResponse =
  | { success: true;  ticker: string; price: number }
  | { success: false; error: string };

export type AppStatus = "idle" | "loading" | "success" | "error";