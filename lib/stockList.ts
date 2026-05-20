// ============================================================
// lib/stockList.ts
// Static list of popular NSE/BSE stocks for autocomplete.
// Format: { symbol, name, exchange }
// symbol is the base ticker — exchange suffix added by formatTicker()
// ============================================================

export interface StockEntry {
  symbol:   string;        // e.g. "RELIANCE"
  name:     string;        // e.g. "Reliance Industries Ltd"
  exchange: "NS" | "BO";   // NS = NSE, BO = BSE
}

export const STOCK_LIST: StockEntry[] = [
  // ── Nifty 50 (NSE) ──────────────────────────────────────
  { symbol: "RELIANCE",      name: "Reliance Industries",         exchange: "NS" },
  { symbol: "TCS",           name: "Tata Consultancy Services",   exchange: "NS" },
  { symbol: "HDFCBANK",      name: "HDFC Bank",                   exchange: "NS" },
  { symbol: "INFY",          name: "Infosys",                     exchange: "NS" },
  { symbol: "ICICIBANK",     name: "ICICI Bank",                  exchange: "NS" },
  { symbol: "HINDUNILVR",    name: "Hindustan Unilever",          exchange: "NS" },
  { symbol: "ITC",           name: "ITC Ltd",                     exchange: "NS" },
  { symbol: "SBIN",          name: "State Bank of India",         exchange: "NS" },
  { symbol: "BHARTIARTL",    name: "Bharti Airtel",               exchange: "NS" },
  { symbol: "KOTAKBANK",     name: "Kotak Mahindra Bank",         exchange: "NS" },
  { symbol: "LT",            name: "Larsen & Toubro",             exchange: "NS" },
  { symbol: "AXISBANK",      name: "Axis Bank",                   exchange: "NS" },
  { symbol: "ASIANPAINT",    name: "Asian Paints",                exchange: "NS" },
  { symbol: "MARUTI",        name: "Maruti Suzuki",               exchange: "NS" },
  { symbol: "SUNPHARMA",     name: "Sun Pharmaceutical",          exchange: "NS" },
  { symbol: "TITAN",         name: "Titan Company",               exchange: "NS" },
  { symbol: "ULTRACEMCO",    name: "UltraTech Cement",            exchange: "NS" },
  { symbol: "BAJFINANCE",    name: "Bajaj Finance",               exchange: "NS" },
  { symbol: "WIPRO",         name: "Wipro",                       exchange: "NS" },
  { symbol: "NESTLEIND",     name: "Nestle India",                exchange: "NS" },
  { symbol: "POWERGRID",     name: "Power Grid Corporation",      exchange: "NS" },
  { symbol: "NTPC",          name: "NTPC Ltd",                    exchange: "NS" },
  { symbol: "ONGC",          name: "Oil & Natural Gas Corp",      exchange: "NS" },
  { symbol: "TECHM",         name: "Tech Mahindra",               exchange: "NS" },
  { symbol: "HCLTECH",       name: "HCL Technologies",            exchange: "NS" },
  { symbol: "JSWSTEEL",      name: "JSW Steel",                   exchange: "NS" },
  { symbol: "TATAMOTORS",    name: "Tata Motors",                 exchange: "NS" },
  { symbol: "TATASTEEL",     name: "Tata Steel",                  exchange: "NS" },
  { symbol: "ADANIENT",      name: "Adani Enterprises",           exchange: "NS" },
  { symbol: "ADANIPORTS",    name: "Adani Ports & SEZ",           exchange: "NS" },
  { symbol: "COALINDIA",     name: "Coal India",                  exchange: "NS" },
  { symbol: "DIVISLAB",      name: "Divi's Laboratories",         exchange: "NS" },
  { symbol: "DRREDDY",       name: "Dr Reddy's Laboratories",     exchange: "NS" },
  { symbol: "EICHERMOT",     name: "Eicher Motors",               exchange: "NS" },
  { symbol: "GRASIM",        name: "Grasim Industries",           exchange: "NS" },
  { symbol: "HEROMOTOCO",    name: "Hero MotoCorp",               exchange: "NS" },
  { symbol: "HINDALCO",      name: "Hindalco Industries",         exchange: "NS" },
  { symbol: "INDUSINDBK",    name: "IndusInd Bank",               exchange: "NS" },
  { symbol: "M&M",           name: "Mahindra & Mahindra",         exchange: "NS" },
  { symbol: "CIPLA",         name: "Cipla",                       exchange: "NS" },
  { symbol: "BAJAJFINSV",    name: "Bajaj Finserv",               exchange: "NS" },
  { symbol: "BRITANNIA",     name: "Britannia Industries",        exchange: "NS" },
  { symbol: "APOLLOHOSP",    name: "Apollo Hospitals",            exchange: "NS" },
  { symbol: "BPCL",          name: "Bharat Petroleum",            exchange: "NS" },
  { symbol: "TATACONSUM",    name: "Tata Consumer Products",      exchange: "NS" },
  { symbol: "SBILIFE",       name: "SBI Life Insurance",          exchange: "NS" },
  { symbol: "HDFCLIFE",      name: "HDFC Life Insurance",         exchange: "NS" },
  { symbol: "UPL",           name: "UPL Ltd",                     exchange: "NS" },
  { symbol: "SHREECEM",      name: "Shree Cement",                exchange: "NS" },
  // ── Mid Cap NSE ─────────────────────────────────────────
  { symbol: "ZOMATO",        name: "Zomato",                      exchange: "NS" },
  { symbol: "PAYTM",         name: "One 97 Communications (Paytm)", exchange: "NS" },
  { symbol: "NYKAA",         name: "FSN E-Commerce (Nykaa)",      exchange: "NS" },
  { symbol: "DMART",         name: "Avenue Supermarts (DMart)",   exchange: "NS" },
  { symbol: "IRCTC",         name: "Indian Railway Catering (IRCTC)", exchange: "NS" },
  { symbol: "HAL",           name: "Hindustan Aeronautics",       exchange: "NS" },
  { symbol: "BEL",           name: "Bharat Electronics",         exchange: "NS" },
  { symbol: "PIDILITIND",    name: "Pidilite Industries",         exchange: "NS" },
  { symbol: "HAVELLS",       name: "Havells India",               exchange: "NS" },
  { symbol: "MARICO",        name: "Marico",                      exchange: "NS" },
  { symbol: "DABUR",         name: "Dabur India",                 exchange: "NS" },
  { symbol: "GODREJCP",      name: "Godrej Consumer Products",    exchange: "NS" },
  { symbol: "MUTHOOTFIN",    name: "Muthoot Finance",             exchange: "NS" },
  { symbol: "CHOLAFIN",      name: "Cholamandalam Investment",    exchange: "NS" },
  { symbol: "PERSISTENT",    name: "Persistent Systems",          exchange: "NS" },
  { symbol: "COFORGE",       name: "Coforge",                     exchange: "NS" },
  { symbol: "MPHASIS",       name: "Mphasis",                     exchange: "NS" },
  { symbol: "LTIM",          name: "LTIMindtree",                 exchange: "NS" },
  // ── BSE-only or BSE-primary ──────────────────────────────
  { symbol: "500325",        name: "Reliance Industries (BSE)",   exchange: "BO" },
  { symbol: "532540",        name: "TCS (BSE)",                   exchange: "BO" },
  { symbol: "500180",        name: "HDFC Bank (BSE)",             exchange: "BO" },
  { symbol: "500209",        name: "Infosys (BSE)",               exchange: "BO" },
  { symbol: "532174",        name: "ICICI Bank (BSE)",            exchange: "BO" },
];

/**
 * Filters the stock list by a query string.
 * Matches against symbol OR company name, case-insensitive.
 * Returns up to `limit` results.
 */
export function searchStocks(query: string, limit = 6): StockEntry[] {
  const q = query.trim().toUpperCase();
  if (!q || q.length < 1) return [];

  return STOCK_LIST.filter(
    (s) =>
      s.symbol.includes(q) ||
      s.name.toUpperCase().includes(q)
  ).slice(0, limit);
}