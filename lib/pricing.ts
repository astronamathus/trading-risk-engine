// Stock price fetching logic
// Handles external API calls to get current stock prices

import { StockPriceResponse } from './types';

/**
 * Fetch stock price from a free API
 * For Indian stocks, we'll use a mock implementation initially
 * In production, you would integrate with a real API like:
 * - Yahoo Finance (unofficial)
 * - Alpha Vantage (free tier)
 * - NSE/BSE official APIs
 */
export async function fetchStockPrice(ticker: string): Promise<StockPriceResponse> {
  const normalizedTicker = ticker.toUpperCase().trim();

  if (!normalizedTicker) {
    throw new Error('Ticker symbol is required');
  }

  try {
    const livePrice = await fetchLiveStockPrice(normalizedTicker);

    return {
      ticker: normalizedTicker,
      price: livePrice,
      currency: 'INR',
      timestamp: new Date().toISOString(),
    };
  } catch {
    const fallbackPrice = await mockFetchStockPrice(normalizedTicker);
    return {
      ticker: normalizedTicker,
      price: fallbackPrice,
      currency: 'INR',
      timestamp: new Date().toISOString(),
    };
  }
}

async function fetchLiveStockPrice(ticker: string): Promise<number> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY ?? DEFAULT_ALPHA_VANTAGE_API_KEY;
  const symbol = `${ticker}.BSE`;

  const response = await fetch(
    `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Live API request failed: ${response.statusText}`);
  }

  const data = (await response.json()) as AlphaVantageQuoteResponse;

  if (data.Note || data.Information || data.ErrorMessage) {
    throw new Error(data.Note || data.Information || data.ErrorMessage || 'Live API returned an error');
  }

  const price = Number(data['Global Quote']?.['05. price']);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Live API returned invalid price');
  }

  return price;
}

async function mockFetchStockPrice(ticker: string): Promise<number> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const mockPrices: Record<string, number> = {
    RELIANCE: 2450.5,
    TCS: 3850.75,
    INFY: 1450.25,
    HDFC: 1650.0,
    ICICI: 1100.5,
    SBIN: 750.25,
    BHARTIARTL: 1250.75,
    ITC: 450.5,
    LICI: 950.0,
    TATAMOTORS: 950.25,
  };

  if (mockPrices[ticker]) {
    return mockPrices[ticker];
  }

  return Math.floor(Math.random() * 4900) + 100;
}
