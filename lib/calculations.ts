
// lib/calculations.ts
import { CalculatorInputs, CalculationResult } from "@/types/index";

export function calculateRiskPerShare(entryPrice: number, stopLoss: number): number {
  return entryPrice - stopLoss;
}

export function calculateMaxRiskAmount(capital: number, riskPercent: number): number {
  return capital * (riskPercent / 100);
}

export function calculatePositionSizeFromRisk(maxRiskAmount: number, riskPerShare: number): number {
  if (riskPerShare <= 0) throw new Error("Risk per share must be greater than zero.");
  return Math.floor(maxRiskAmount / riskPerShare);
}

export function calculateCapitalRequired(positionSize: number, entryPrice: number): number {
  return positionSize * entryPrice;
}

export function validateInputs(inputs: CalculatorInputs): string | null {
  const { ticker, stopLoss, capital, riskPercent, rrRatio } = inputs;
  if (!ticker.trim())                        return "Please enter a stock ticker.";
  if (stopLoss <= 0)                         return "Stop loss must be greater than zero.";
  if (capital <= 0)                          return "Capital must be greater than zero.";
  if (riskPercent <= 0 || riskPercent > 100) return "Risk percentage must be between 0 and 100.";
  if (rrRatio < 0.5 || rrRatio > 20)        return "R:R ratio must be between 0.5 and 20.";
  return null;
}

export function validateStopLoss(
  stopLoss: number, entryPrice: number, capital: number, riskPercent: number
): string | null {
  if (stopLoss >= entryPrice)
    return `Stop loss must be below the current price (${entryPrice.toFixed(2)}).`;
  const maxRisk   = capital * (riskPercent / 100);
  const riskPerSh = entryPrice - stopLoss;
  if (riskPerSh > maxRisk)
    return `Risk per share (${riskPerSh.toFixed(2)}) exceeds your max risk budget (${maxRisk.toFixed(2)}). Widen your stop loss or increase capital.`;
  return null;
}

export function calculatePosition(inputs: CalculatorInputs, entryPrice: number): CalculationResult {
  const { stopLoss, capital, riskPercent, rrRatio } = inputs;
  const rr = Math.max(0.5, rrRatio || 2);

  const riskPerShare    = calculateRiskPerShare(entryPrice, stopLoss);
  if (riskPerShare <= 0) throw new Error("Stop loss must be lower than the current market price.");

  const maxRiskAmount   = calculateMaxRiskAmount(capital, riskPercent);
  const positionSize    = calculatePositionSizeFromRisk(maxRiskAmount, riskPerShare);
  const capitalRequired = round(calculateCapitalRequired(positionSize, entryPrice));
  const target          = round(entryPrice + rr * riskPerShare);

  return {
    entryPrice,
    riskPerShare:  round(riskPerShare),
    maxRiskAmount: round(maxRiskAmount),
    positionSize,
    capitalRequired,
    target,
    rrRatio:       rr,
  };
}

export function recalculateWithCapitalLimit(
  limitCapital: number, entryPrice: number, riskPerShare: number
): { positionSize: number; actualRisk: number; capitalRequired: number } {
  const positionSize    = Math.floor(limitCapital / entryPrice);
  const actualRisk      = round(positionSize * riskPerShare);
  const capitalRequired = round(positionSize * entryPrice);
  return { positionSize, actualRisk, capitalRequired };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}