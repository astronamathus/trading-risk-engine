// ============================================================
// lib/pricing.ts
// Fetches stock price from Yahoo Finance.
// Uses the v7 "quote" endpoint which is more stable than v8.
// ============================================================

export function formatTicker(rawTicker: string): string {
  const ticker = rawTicker.trim().toUpperCase();
  if (ticker.includes(".")) return ticker;
  if (/^\d+$/.test(ticker)) return `${ticker}.BO`;
  return `${ticker}.NS`;
}

export async function fetchStockPrice(rawTicker: string): Promise<number> {
  const ticker = formatTicker(rawTicker);

  // Using Yahoo Finance v7 quote endpoint — more reliable than v8 chart
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}&fields=regularMarketPrice`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Mimic a real browser request — Yahoo blocks plain Node.js agents
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/",
        "Origin": "https://finance.yahoo.com",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(
        `Yahoo Finance returned HTTP ${response.status}. Ticker "${ticker}" may be invalid.`
      );
    }

    const data = await response.json();

    // Navigate Yahoo's v7 response shape
    const quote = data?.quoteResponse?.result?.[0];
    const price: number | undefined = quote?.regularMarketPrice;

    if (!price || price <= 0) {
      throw new Error(
        `No price found for "${ticker}". Make sure the ticker is valid (e.g. RELIANCE, TCS, INFY).`
      );
    }

    return price;
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out after 10s. Try again.");
      }
      throw err;
    }
    throw new Error("Unknown error fetching stock price.");
  }
}