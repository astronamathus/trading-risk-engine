// Position sizing calculations
// Pure functions - no side effects, easy to test

import { PositionInput, PositionOutput } from './types';

/**
 * Calculate risk per share
 * Formula: Entry Price - Stop Loss
 */
export function calculateRiskPerShare(entryPrice: number, stopLoss: number): number {
  return entryPrice - stopLoss;
}

/**
 * Calculate maximum risk amount
 * Formula: Capital × (Risk Percentage / 100)
 */
export function calculateMaxRiskAmount(capital: number, riskPercentage: number): number {
  return capital * (riskPercentage / 100);
}

/**
 * Calculate position size (number of shares)
 * Formula: Max Risk Amount / Risk Per Share
 */
export function calculatePositionSizeFromRisk(maxRiskAmount: number, riskPerShare: number): number {
  if (riskPerShare <= 0) {
    throw new Error('Risk per share must be greater than zero');
  }
  return Math.floor(maxRiskAmount / riskPerShare);
}

/**
 * Calculate capital required for the position
 * Formula: Position Size × Entry Price
 */
export function calculateCapitalRequired(positionSize: number, entryPrice: number): number {
  return positionSize * entryPrice;
}

/**
 * Main calculation function - computes all position sizing metrics
 * Takes user input and stock price, returns complete calculation results
 */
export function calculatePositionSize(
  input: PositionInput,
  stockPrice: number
): PositionOutput {
  const riskPerShare = calculateRiskPerShare(stockPrice, input.stopLoss);
  const maxRiskAmount = calculateMaxRiskAmount(input.capital, input.riskPercentage);
  const positionSize = calculatePositionSizeFromRisk(maxRiskAmount, riskPerShare);
  const capitalRequired = calculateCapitalRequired(positionSize, stockPrice);

  return {
    riskPerShare,
    maxRiskAmount,
    positionSize,
    capitalRequired,
  };
}

/**
 * Validate input data
 * Returns array of validation errors, empty if valid
 */
export function validateInput(input: PositionInput): string[] {
  const errors: string[] = [];

  if (!input.ticker || input.ticker.trim() === '') {
    errors.push('Ticker symbol is required');
  }

  if (input.stopLoss <= 0) {
    errors.push('Stop loss must be greater than zero');
  }

  if (input.capital <= 0) {
    errors.push('Capital must be greater than zero');
  }

  if (input.riskPercentage <= 0 || input.riskPercentage > 100) {
    errors.push('Risk percentage must be between 0 and 100');
  }

  return errors;
}
