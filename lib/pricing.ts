// ============================================================
// lib/pricing.ts
// All prices fetched from Yahoo Finance.
// NSE stocks → SYMBOL.NS
// BSE stocks → SYMBOL.BO
//
// Primary endpoint: v7/finance/quote (fast, structured)
// Fallback endpoint: v8/finance/chart (more permissive, handles 401s)
// ============================================================

export function detectExchange(rawTicker: string): "NSE" | "BSE" {
  const t = rawTicker.trim().toUpperCase();
  if (t.endsWith(".BO") || t.endsWith(".BSE")) return "BSE";
  return "NSE";
}

function stripSuffix(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.(NS|NSE|BO|BSE)$/, "");
}

export function formatTicker(rawTicker: string): string {
  const base     = stripSuffix(rawTicker);
  const exchange = detectExchange(rawTicker);
  return exchange === "BSE" ? `${base}.BO` : `${base}.NS`;
}

const YAHOO_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept":          "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer":         "https://finance.yahoo.com/",
};

export async function fetchStockPrice(rawTicker: string): Promise<number> {
  const ticker     = formatTicker(rawTicker);
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);

  try {
    // ── Primary: v7 quote endpoint ──────────────────────────
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketPrice`;
    const res      = await fetch(quoteUrl, { signal: controller.signal, headers: YAHOO_HEADERS });

    if (res.ok) {
      const data  = await res.json();
      const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice as number | undefined;
      if (price && price > 0) { clearTimeout(timeout); return price; }
    }

    // ── Fallback: v8 chart endpoint (handles 401/429) ───────
    const chartUrl  = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const chartRes  = await fetch(chartUrl, { signal: controller.signal, headers: YAHOO_HEADERS });

    if (!chartRes.ok) throw new Error(`Yahoo Finance returned HTTP ${chartRes.status} for "${ticker}".`);

    const chartData = await chartRes.json();
    const chartPrice = chartData?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined;

    if (!chartPrice || chartPrice <= 0)
      throw new Error(`No price found for "${ticker}". Check the symbol and exchange suffix (.NS or .BO).`);

    clearTimeout(timeout);
    return chartPrice;

  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error) {
      if (err.name === "AbortError") throw new Error("Yahoo Finance request timed out. Try again.");
      throw err;
    }
    throw new Error("Unknown error fetching stock price.");
  }
}