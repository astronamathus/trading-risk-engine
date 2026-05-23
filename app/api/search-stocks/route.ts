// ============================================================
// app/api/search-stocks/route.ts
// Proxies Alpha Vantage SYMBOL_SEARCH, filtered to Indian stocks.
// Returns exchange as "NSE" or "BSE" for badge colouring.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 1) return NextResponse.json({ results: [] });

  const apiKey = process.env.ALPHA_VANTAGE_SEARCH_KEY;
  if (!apiKey) return NextResponse.json({ error: "Search API key not configured." }, { status: 500 });

  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(q)}&apikey=${apiKey}`;

  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`Search returned ${response.status}`);

    const data = await response.json();
    if (data["Note"] || data["Information"]) {
      return NextResponse.json({ error: "Search rate limit reached." }, { status: 429 });
    }

    const results = (data["bestMatches"] ?? [])
      .filter((m: Record<string, string>) => {
        const region = m["4. region"] ?? "";
        const symbol = m["1. symbol"] ?? "";
        // Only Indian equities
        return (
          (region.includes("India") || symbol.endsWith(".BSE")) &&
          m["3. type"] === "Equity"
        );
      })
      .map((m: Record<string, string>) => {
        const symbol = m["1. symbol"] ?? "";
        // Determine exchange from symbol suffix
        const exchange = symbol.endsWith(".BSE") ? "BSE" : "NSE";
        return {
          symbol,
          name: m["2. name"] ?? symbol,
          exchange,
        };
      })
      .slice(0, 8);

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}