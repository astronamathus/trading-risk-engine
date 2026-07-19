// ============================================================
// app/api/search-stocks/route.ts
// Price proxy only — search is now handled locally via stockList.ts
//
// Usage: GET /api/search-stocks?ticker=RELIANCE.NS
// Returns: { success, ticker, price }
// ============================================================
import { fetchStockPrice, detectMarket } from "@/lib/pricing";
import type { Market } from "@/lib/pricing";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("ticker")?.trim();
  const market = (searchParams.get("market") ?? undefined) as Market | undefined;

  if (!ticker) {
    return Response.json({ success: false, error: "ticker is required" }, { status: 400 });
  }

  try {
    const resolvedMarket = market ?? detectMarket(ticker);
    const price = await fetchStockPrice(ticker, resolvedMarket);

    // Determine exchange label
    const isINR = resolvedMarket === "INR";
    const exchange = isINR
      ? (ticker.toUpperCase().endsWith(".BO") ? "BSE" : "NSE")
      : (ticker.toUpperCase().includes(".") ? "NYSE" : "NYSE");

    return Response.json({
      success:  true,
      ticker:   ticker.toUpperCase(),
      price,
      market:   resolvedMarket,
      exchange,
    });
  } catch (err) {
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : "Failed to fetch price" },
      { status: 500 }
    );
  }
}