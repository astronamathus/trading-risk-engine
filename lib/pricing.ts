// ============================================================
// lib/pricing.ts
// NSE stocks → Yahoo Finance (free, no key, .NS suffix)
// BSE stocks → Alpha Vantage (GLOBAL_QUOTE, .BSE suffix)
// ============================================================

/**
 * Detects exchange from any ticker format the user might type:
 *   RELIANCE        → NSE (default)
 *   RELIANCE.NS     → NSE
 *   RELIANCE.NSE    → NSE (user typo — treated as NSE)
 *   RELIANCE.BSE    → BSE
 *   RELIANCE.BO     → BSE
 */
export function detectExchange(rawTicker: string): "NSE" | "BSE" {
  const t = rawTicker.trim().toUpperCase();
  if (t.endsWith(".BSE") || t.endsWith(".BO")) return "BSE";
  return "NSE";
}

/**
 * Strips any exchange suffix from a ticker.
 * e.g. RELIANCE.NS → RELIANCE, RELIANCE.BSE → RELIANCE
 */
function stripSuffix(ticker: string): string {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/\.(NS|NSE|BO|BSE)$/, "");
}

/**
 * Formats ticker for the correct API:
 *   NSE → RELIANCE.NS   (Yahoo Finance)
 *   BSE → RELIANCE.BSE  (Alpha Vantage)
 */
export function formatTicker(rawTicker: string): string {
  const base     = stripSuffix(rawTicker);
  const exchange = detectExchange(rawTicker);
  return exchange === "BSE" ? `${base}.BSE` : `${base}.NS`;
}

/** Fetch live price from Yahoo Finance — for NSE stocks */
async function fetchFromYahoo(ticker: string): Promise<number> {
  const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=regularMarketPrice`;
  const chartUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(quoteUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept":     "application/json",
        "Referer":    "https://finance.yahoo.com/",
      },
    });
    clearTimeout(timeout);

    // Yahoo occasionally blocks /quote with 401 in some regions/environments.
    // Fallback to the chart endpoint, which is often more permissive.
    if (!res.ok) {
      if (res.status === 401) {
        const chartRes = await fetch(chartUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
            "Referer": "https://finance.yahoo.com/",
          },
        });

        if (!chartRes.ok) {
          throw new Error(`Yahoo Finance returned HTTP ${res.status} (quote) and ${chartRes.status} (chart)`);
        }

        const chartData = await chartRes.json();
        const chartPrice = chartData?.chart?.result?.[0]?.meta?.regularMarketPrice as number | undefined;
        if (!chartPrice || chartPrice <= 0) {
          throw new Error(`No price found for "${ticker}". Check the NSE symbol.`);
        }
        return chartPrice;
      }

      throw new Error(`Yahoo Finance returned HTTP ${res.status}`);
    }

    const data  = await res.json();
    const price = data?.quoteResponse?.result?.[0]?.regularMarketPrice as number | undefined;

    if (!price || price <= 0)
      throw new Error(`No price found for "${ticker}". Check the NSE symbol.`);

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

/** Fetch live price from Alpha Vantage — for BSE stocks */
async function fetchFromAlphaVantage(ticker: string): Promise<number> {
  const apiKey = process.env.ALPHA_VANTAGE_KEY;
  if (!apiKey) throw new Error("ALPHA_VANTAGE_KEY not set in .env.local");

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;

  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Alpha Vantage returned HTTP ${res.status}`);

    const data = await res.json();

    if (data["Note"] || data["Information"])
      throw new Error("Alpha Vantage rate limit reached (25 req/day on free tier).");

    const priceStr = data["Global Quote"]?.["05. price"] as string | undefined;
    if (!priceStr || parseFloat(priceStr) <= 0)
      throw new Error(`No price found for "${ticker}". Check the BSE symbol.`);

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

/** Main export — routes to correct API based on detected exchange */
export async function fetchStockPrice(rawTicker: string): Promise<number> {
  const exchange = detectExchange(rawTicker);
  const ticker   = formatTicker(rawTicker);
  return exchange === "BSE"
    ? fetchFromAlphaVantage(ticker)
    : fetchFromYahoo(ticker);
}
