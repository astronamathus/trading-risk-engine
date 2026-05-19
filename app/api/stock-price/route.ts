import { NextRequest, NextResponse } from 'next/server';
import { fetchStockPrice } from '@/lib/pricing';

const TICKER_REGEX = /^[A-Za-z0-9.-]{1,15}$/;

export async function GET(request: NextRequest) {
  try {
    const ticker = request.nextUrl.searchParams.get('ticker')?.trim();

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker parameter is required' }, { status: 400 });
    }

    if (!TICKER_REGEX.test(ticker)) {
      return NextResponse.json(
        { error: 'Ticker must be 1-15 chars and contain only letters, numbers, dot, or hyphen' },
        { status: 400 }
      );
    }

    const stockPrice = await fetchStockPrice(ticker);

    return NextResponse.json(stockPrice, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error fetching stock price:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stock price' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
