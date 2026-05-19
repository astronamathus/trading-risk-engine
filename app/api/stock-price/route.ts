// API route for fetching stock prices
// This is a Next.js App Router API route
// It handles GET requests to /api/stock-price?ticker=SYMBOL

import { NextRequest, NextResponse } from 'next/server';
import { fetchStockPrice } from '@/lib/pricing';

export async function GET(request: NextRequest) {
  try {
    // Get ticker from query parameters
    const searchParams = request.nextUrl.searchParams;
    const ticker = searchParams.get('ticker');

    // Validate ticker parameter
    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker parameter is required' },
        { status: 400 }
      );
    }

    // Fetch stock price using our pricing logic
    const stockPrice = await fetchStockPrice(ticker);

    // Return the stock price data
    return NextResponse.json(stockPrice);
  } catch (error) {
    // Handle errors
    console.error('Error fetching stock price:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch stock price' 
      },
      { status: 500 }
    );
  }
}
