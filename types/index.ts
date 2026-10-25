// ============================================================
// types/index.ts
// Single source of truth for all TypeScript interfaces.
// If more than one file uses a type, it lives here.
// ============================================================
export interface CalculatorInputs {
  market: "INR" | "USD";
  exchange: "NSE" | "BSE" | "NYSE" | "NASDAQ";
  ticker:      string;
  stopLoss:    number;
  capital:     number;
  riskPercent: number;
  riskRatio:   number;   // risk side of R:R, defaults to 1
  rewardRatio: number;   // reward side of R:R, defaults to 2
  entryPrice:  number;
}

export interface CalculationResult {
  entryPrice:      number;
  riskPerShare:    number;
  maxRiskAmount:   number;
  positionSize:    number;
  capitalRequired: number;
  target:          number;  // entry + (rewardRatio / riskRatio) × riskPerShare
  riskRatio:       number;
  rewardRatio:     number;
  rrRatio:         number;  // derived reward/risk multiplier
}

export type StockPriceResponse =
  | { success: true;  ticker: string; price: number }
  | { success: false; error: string };

export type AppStatus = "idle" | "loading" | "success" | "error";