// ============================================================
// lib/pricing.ts
// NSE stocks  → Yahoo Finance (free, no key, reliable for .NS)
// BSE stocks  → Alpha Vantage (GLOBAL_QUOTE with SYMBOL.BSE)
//
// How we detect exchange: check for .NS / .BO / .BSE suffix.
// Default (no suffix) → NSE via Yahoo.
// ============================================================

/** Returns which exchange a ticker belongs to */
export function detectExchange(rawTicker: string): "NSE" | "BSE" {
  const t = rawTicker.trim().toUpperCase();
  if (t.endsWith(".BSE") || t.endsWith(".BO")) return "BSE";
  return "NSE"; // .NS or no suffix → NSE
}

/**
 * Normalises ticker for whichever API will handle it.
 * Yahoo: RELIANCE → RELIANCE.NS
 * Alpha Vantage: RELIANCE.BO / RELIANCE.NS → RELIANCE.BSE
 */
export function formatTicker(rawTicker: string): string {
  const t = rawTicker.trim().toUpperCase();
  const exchange = detectExchange(t);

  if (exchange === "BSE") {
    // Strip any suffix and apply .BSE for Alpha Vantage
    return t.replace(/\.(BSE|BO|NS)$/, "") + ".BSE";
  } else {
    // Strip any suffix and apply .NS for Yahoo Finance
    if (t.includes(".")) return t.replace(/\.(NS|BO|BSE)$/, "") + ".NS";
    return `${t}.NS`;
  }
}

/** Fetch from Yahoo Finance — used for NSE stocks */
async function fetchFromYahoo(ticker: string): Promise<number> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=regularMarketPrice`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://finance.yahoo.com/",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Yahoo Finance returned HTTP ${res.status}`);

    const data = await res.json();
    const price: number | undefined = data?.quoteResponse?.result?.[0]?.regularMarketPrice;
    if (!price || price <= 0) throw new Error(`No price found for "${ticker}" on NSE.`);
    return price;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error) {
      if (err.name === "AbortError") throw new Error("Yahoo Finance request timed out.");
      throw err;
    }
    throw new Error("Unknown error fetching from Yahoo Finance.");
  }
}

/** Fetch from Alpha Vantage — used for BSE stocks */
async function fetchFromAlphaVantage(ticker: string): Promise<number> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) throw new Error("Alpha Vantage API key not configured in .env.local");

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`Alpha Vantage returned HTTP ${res.status}`);

    const data = await res.json();
    if (data["Note"] || data["Information"]) {
      throw new Error("Alpha Vantage rate limit reached (25 req/day on free tier).");
    }

    const priceStr: string | undefined = data["Global Quote"]?.["05. price"];
    if (!priceStr || parseFloat(priceStr) <= 0) {
      throw new Error(`No price found for "${ticker}" on BSE.`);
    }
    return parseFloat(priceStr);
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error) {
      if (err.name === "AbortError") throw new Error("Alpha Vantage request timed out.");
      throw err;
    }
    throw new Error("Unknown error fetching from Alpha Vantage.");
  }
}

/** Main export — routes to correct API based on exchange */
export async function fetchStockPrice(rawTicker: string): Promise<number> {
  const exchange = detectExchange(rawTicker);
  const ticker   = formatTicker(rawTicker);

  if (exchange === "BSE") return fetchFromAlphaVantage(ticker);
  return fetchFromYahoo(ticker);
}