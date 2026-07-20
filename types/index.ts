// ============================================================
// types/index.ts
// Single source of truth for all TypeScript interfaces.
// If more than one file uses a type, it lives here.
// ============================================================
export interface CalculatorInputs {
  ticker:      string;
  stopLoss:    number;
  capital:     number;
  riskPercent: number;
  rrRatio:     number;   // reward side of 1:R, e.g. 2 → target = entry + 2 × riskPerShare
  entryPrice:  number;
}

export interface CalculationResult {
  entryPrice:      number;
  riskPerShare:    number;
  maxRiskAmount:   number;
  positionSize:    number;
  capitalRequired: number;
  target:          number;  // entry + rrRatio × riskPerShare
  rrRatio:         number;
}

export type StockPriceResponse =
  | { success: true;  ticker: string; price: number }
  | { success: false; error: string };

export type AppStatus = "idle" | "loading" | "success" | "error";