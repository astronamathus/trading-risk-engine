// ============================================================
// app/api/search-stocks/route.ts
// Price proxy only — search is now handled locally via stockList.ts
//
// Usage: GET /api/search-stocks?ticker=RELIANCE.NS
// Returns: { success, ticker, price }
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchStockPrice, formatTicker } from "@/lib/pricing";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim();

  if (!ticker) {
    return NextResponse.json(
      { success: false, error: "Missing required parameter: ticker" },
      { status: 400 }
    );
  }

  try {
    const price = await fetchStockPrice(ticker);
    return NextResponse.json(
      { success: true, ticker: formatTicker(ticker), price },
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch stock price.";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}