import type { Market } from "@/lib/pricing";

/** Currency is derived from the canonical ticker: Indian symbols carry .NS/.BO; US symbols do not. */
export function marketFromTicker(ticker: string): Market {
  return /\.(NS|NSE|BO|BSE)$/i.test(ticker.trim()) ? "INR" : "USD";
}

export function formatMoney(value: number, market: Market): string {
  return new Intl.NumberFormat(market === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency: market,
    maximumFractionDigits: 2,
  }).format(value);
}

export function currencySymbol(market: Market): string {
  return market === "INR" ? "₹" : "$";
}
