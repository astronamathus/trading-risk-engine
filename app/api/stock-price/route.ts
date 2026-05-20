// ============================================================
// app/api/stock-price/route.ts
// Next.js API Route — acts as a secure proxy to Yahoo Finance.
//
// Why a proxy? Two reasons:
// 1. CORS: Browsers block direct calls to Yahoo Finance.
// 2. Control: We can add caching, rate limiting, or swap
//    the data source later — all in one place.
//
// Usage: GET /api/stock-price?ticker=RELIANCE
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchStockPrice } from "@/lib/pricing";
import { StockPriceResponse } from "@/types";

export async function GET(request: NextRequest) {
  // Extract the ticker from the query string: ?ticker=RELIANCE
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  // Basic guard: ticker is required
  if (!ticker || ticker.trim() === "") {
    const body: StockPriceResponse = {
      success: false,
      error: "Missing required query parameter: ticker",
    };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    const price = await fetchStockPrice(ticker);

    const body: StockPriceResponse = {
      success: true,
      ticker: ticker.toUpperCase(),
      price,
    };

    // Cache the response for 60 seconds.
    // This avoids hammering Yahoo Finance if the user re-submits quickly.
    return NextResponse.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch stock price.";

    const body: StockPriceResponse = {
      success: false,
      error: message,
    };

    return NextResponse.json(body, { status: 502 });
  }
}