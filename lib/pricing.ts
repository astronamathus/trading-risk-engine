// ============================================================
// lib/pricing.ts
// Handles fetching stock price from Yahoo Finance.
// This runs ONLY on the server (inside our API route).
//
// Why server-only? Because calling external APIs from the
// browser leaks your server logic and can hit CORS errors.
// ============================================================

/**
 * Formats a user-entered ticker into Yahoo Finance format.
 *
 * NSE stocks: RELIANCE → RELIANCE.NS
 * BSE stocks: 500325   → 500325.BO
 *
 * Rule: if it's all digits → BSE. Otherwise → NSE.
 * Users can also manually type RELIANCE.NS to override.
 */
export function formatTicker(rawTicker: string): string {
  const ticker = rawTicker.trim().toUpperCase();

  // Already has an exchange suffix — use as-is
  if (ticker.includes(".")) return ticker;

  // Pure number = BSE code
  if (/^\d+$/.test(ticker)) return `${ticker}.BO`;

  // Default to NSE
  return `${ticker}.NS`;
}

/**
 * Fetches the current stock price from Yahoo Finance.
 *
 * Yahoo Finance provides a free, undocumented JSON endpoint.
 * It's used by many open-source projects and works well for MVPs.
 *
 * Returns the price as a number, or throws an error with a
 * human-readable message.
 */
export async function fetchStockPrice(rawTicker: string): Promise<number> {
  const ticker = formatTicker(rawTicker);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;

  // We set a timeout so the app doesn't hang if Yahoo is slow
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // Tell Yahoo we're a browser (some rate limits are per user-agent)
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned status ${response.status}`);
    }

    const data = await response.json();

    // Dig into Yahoo's response structure to find the price
    const price: number | undefined =
      data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    if (!price || price <= 0) {
      throw new Error(
        `Could not find price for "${ticker}". Check the ticker symbol.`
      );
    }

    return price;
  } catch (err) {
    clearTimeout(timeout);

    // Re-throw with a cleaner message for the API route to handle
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out. Yahoo Finance may be slow.");
      }
      throw err;
    }

    throw new Error("Unknown error fetching stock price.");
  }
}