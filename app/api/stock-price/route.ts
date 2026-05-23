// ============================================================
// app/api/stock-price/route.ts
// Proxy route — keeps Yahoo Finance calls server-side.
// Added console.log so you can see exactly what's happening
// in your terminal (where `npm run dev` is running).
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchStockPrice, formatTicker } from "@/lib/pricing";
import { StockPriceResponse } from "@/types";

// Ensure env var is available — will throw at build time if missing
// Add ALPHA_VANTAGE_KEY=your_key to .env.local

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  console.log("[stock-price] Request received. Ticker:", ticker);

  if (!ticker || ticker.trim() === "") {
    return NextResponse.json(
      { success: false, error: "Missing query parameter: ticker" } satisfies StockPriceResponse,
      { status: 400 }
    );
  }

  const formatted = formatTicker(ticker);
  console.log("[stock-price] Formatted ticker:", formatted);

  try {
    const price = await fetchStockPrice(ticker);
    console.log("[stock-price] Price fetched successfully:", price);

    return NextResponse.json(
      { success: true, ticker: formatted, price } satisfies StockPriceResponse,
      {
        status: 200,
        headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch stock price.";
    console.error("[stock-price] Error:", message);

    return NextResponse.json(
      { success: false, error: message } satisfies StockPriceResponse,
      { status: 502 }
    );
  }
}