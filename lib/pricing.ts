// Stock price fetching logic
// Handles external API calls to get current stock prices

import { StockPriceResponse, ApiError } from './types';

/**
 * Fetch stock price from a free API
 * For Indian stocks, we'll use a mock implementation initially
 * In production, you would integrate with a real API like:
 * - Yahoo Finance (unofficial)
 * - Alpha Vantage (free tier)
 * - NSE/BSE official APIs
 */
export async function fetchStockPrice(ticker: string): Promise<StockPriceResponse> {
  // Normalize ticker to uppercase
  const normalizedTicker = ticker.toUpperCase().trim();

  if (!normalizedTicker) {
    throw new Error('Ticker symbol is required');
  }

  try {
    // For MVP, we'll use a mock implementation
    // This simulates an API call with realistic data
    const mockPrice = await mockFetchStockPrice(normalizedTicker);
    
    return {
      ticker: normalizedTicker,
      price: mockPrice,
      currency: 'INR',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to fetch stock price: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mock implementation for development
 * Returns realistic prices for common Indian stocks
 * In production, replace this with actual API calls
 */
async function mockFetchStockPrice(ticker: string): Promise<number> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Mock prices for common Indian stocks (in INR)
  const mockPrices: Record<string, number> = {
    'RELIANCE': 2450.50,
    'TCS': 3850.75,
    'INFY': 1450.25,
    'HDFC': 1650.00,
    'ICICI': 1100.50,
    'SBIN': 750.25,
    'BHARTIARTL': 1250.75,
    'ITC': 450.50,
    'LICI': 950.00,
    'TATAMOTORS': 950.25,
  };

  // Return mock price if available, otherwise generate a random realistic price
  if (mockPrices[ticker]) {
    return mockPrices[ticker];
  }

  // Generate a random price between 100 and 5000 for unknown tickers
  return Math.floor(Math.random() * 4900) + 100;
}

/**
 * Real API implementation example (commented out for MVP)
 * This shows how you would integrate with a real API
 * 
 * Uncomment and modify when you have access to a real API
 */
/*
async function realFetchStockPrice(ticker: string): Promise<number> {
  const response = await fetch(
    `https://api.example.com/stock/${ticker}?apikey=YOUR_API_KEY`
  );

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.price;
}
*/
