// ============================================================
// lib/pricing.ts
// Price fetching from Yahoo Finance.
// INR: NSE → SYMBOL.NS, BSE → SYMBOL.BO
// USD: NYSE/NASDAQ → SYMBOL (no suffix)
// ============================================================

export type Market = "INR" | "USD";

export function detectExchange(rawTicker: string): "NSE" | "BSE" | "NYSE" | "NASDAQ" {
  const t = rawTicker.trim().toUpperCase();
  if (t.endsWith(".BO") || t.endsWith(".BSE")) return "BSE";
  if (t.endsWith(".NS") || t.endsWith(".NSE")) return "NSE";
  // US stocks have no suffix — treat as NYSE by default
  return "NYSE";
}

export function detectMarket(rawTicker: string): Market {
  const t = rawTicker.trim().toUpperCase();
  if (t.endsWith(".BO") || t.endsWith(".NS") || t.endsWith(".NSE") || t.endsWith(".BSE")) return "INR";
  // If it's a pure symbol with no suffix, check if it looks like an Indian ticker
  // Indian symbols are usually longer and may contain numbers
  return "USD";
}

export function formatTicker(rawTicker: string, market?: Market): string {
  const base = rawTicker.trim().toUpperCase().replace(/\.(NS|NSE|BO|BSE)$/, "");
  if (market === "USD") return base; // US stocks: no suffix
  const t = rawTicker.trim().toUpperCase();
  if (t.endsWith(".BO") || t.endsWith(".BSE")) return `${base}.BO`;
  return `${base}.NS`; // default NSE for INR
}

const YAHOO_HEADERS = {
  "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "Accept":          "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer":         "https://finance.yahoo.com/",
};

export async function fetchStockPrice(rawTicker: string, market?: Market): Promise<number> {
  const ticker     = formatTicker(rawTicker, market);
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);

  try {
    // Primary: v7 quote endpoint
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&fields=regularMarketPrice`;
    const res      = await fetch(quoteUrl, { signal: controller.signal, headers: YAHOO_HEADERS });

    if (res.ok) {
      const data  = await res.json();
      const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice as number | undefined;
      if (price && price > 0) { clearTimeout(timeout); return price; }
    }

    // Fallback: v8 chart endpoint
    const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const chartRes = await fetch(chartUrl, { signal: controller.signal, headers: YAHOO_HEADERS });

    if (!chartRes.ok) throw new Error(`Yahoo Finance returned HTTP ${chartRes.status} for "${ticker}".`);

    const chartData  = await chartRes.json();
    const chartPrice = chartData?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined;

    if (!chartPrice || chartPrice <= 0)
      throw new Error(`No price found for "${ticker}". Check the symbol is correct.`);

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