// TypeScript interfaces for the trading risk calculator
// This file defines the shape of data throughout the application

// Input data from the user form
export interface PositionInput {
  ticker: string;           // Stock symbol (e.g., "RELIANCE", "TCS")
  stopLoss: number;         // Stop loss price per share
  capital: number;          // Total capital available (in rupees)
  riskPercentage: number;   // Risk percentage (e.g., 2 for 2%)
}

// Output data from calculations
export interface PositionOutput {
  riskPerShare: number;     // Risk amount per share (Entry - Stop Loss)
  maxRiskAmount: number;    // Maximum rupee risk (Capital × Risk%)
  positionSize: number;     // Number of shares to buy
  capitalRequired: number;  // Total capital needed for the position
}

// Combined result including input and output
export interface CalculationResult {
  input: PositionInput;
  stockPrice: number;       // Current stock price
  output: PositionOutput;
}

// API response from stock price service
export interface StockPriceResponse {
  ticker: string;
  price: number;
  currency: string;
  timestamp: string;
}

// Error types for better error handling
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError {
  message: string;
  code?: string;
}
