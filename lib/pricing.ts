// ============================================================
// lib/pricing.ts
// Fetches live stock price from Alpha Vantage.
//
// Alpha Vantage Indian stock ticker formats:
//   NSE stocks → RELIANCE.BSE  (confusingly named .BSE but works for NSE too)
//   BSE stocks → RELIANCE.BSE  (same format)
//
// The GLOBAL_QUOTE endpoint returns the latest trading day price.
// Rate limit: 25 requests/day on free tier.
// ============================================================

/**
 * Formats a user-entered ticker into Alpha Vantage format.
 *
 * User types:   RELIANCE, RELIANCE.NS, RELIANCE.BO
 * AV expects:   RELIANCE.BSE
 *
 * AV uses .BSE suffix for all Indian stocks (NSE + BSE).
 * We strip any .NS or .BO suffix and apply .BSE.
 */
export function formatTicker(rawTicker: string): string {
  const ticker = rawTicker.trim().toUpperCase();

  // Strip known exchange suffixes — AV uses its own format
  const base = ticker
    .replace(/\.NS$/, "")
    .replace(/\.BO$/, "")
    .replace(/\.BSE$/, "");

  return `${base}.BSE`;
}

/**
 * Fetches the current stock price from Alpha Vantage GLOBAL_QUOTE.
 * Returns price as a number in INR, or throws a human-readable error.
 */
export async function fetchStockPrice(rawTicker: string): Promise<number> {
  const ticker = formatTicker(rawTicker);
  const apiKey = process.env.ALPHA_VANTAGE_KEY;

  if (!apiKey) throw new Error("Alpha Vantage API key not configured.");

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Alpha Vantage returned HTTP ${response.status}.`);
    }

    const data = await response.json();

    // AV returns a rate-limit message instead of data when exceeded
    if (data["Note"] || data["Information"]) {
      throw new Error(
        "Alpha Vantage rate limit reached (25 requests/day on free tier). Try again tomorrow."
      );
    }

    const quote = data["Global Quote"];
    const priceStr: string | undefined = quote?.["05. price"];

    if (!priceStr || parseFloat(priceStr) <= 0) {
      throw new Error(
        `No price found for "${ticker}". The symbol may be incorrect or not listed on Indian exchanges.`
      );
    }

    return parseFloat(priceStr);

  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error) {
      if (err.name === "AbortError") throw new Error("Request timed out after 10s. Try again.");
      throw err;
    }
    throw new Error("Unknown error fetching stock price.");
  }
}