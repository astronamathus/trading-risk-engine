// ============================================================
// lib/nifty100.ts
// Hardcoded Nifty 100 stocks for instant NSE search results.
// Symbol is the base NSE symbol — formatTicker appends .NS
// for Yahoo Finance automatically.
// ============================================================

export interface NseStock {
  symbol:   string;   // e.g. "RELIANCE"
  name:     string;   // e.g. "Reliance Industries Ltd"
  exchange: "NSE";
}

export const NIFTY_100: NseStock[] = [
  { symbol: "RELIANCE",     name: "Reliance Industries",             exchange: "NSE" },
  { symbol: "TCS",          name: "Tata Consultancy Services",       exchange: "NSE" },
  { symbol: "HDFCBANK",     name: "HDFC Bank",                       exchange: "NSE" },
  { symbol: "BHARTIARTL",   name: "Bharti Airtel",                   exchange: "NSE" },
  { symbol: "ICICIBANK",    name: "ICICI Bank",                      exchange: "NSE" },
  { symbol: "INFOSYS",      name: "Infosys",                         exchange: "NSE" },
  { symbol: "INFY",         name: "Infosys (Alt)",                   exchange: "NSE" },
  { symbol: "SBIN",         name: "State Bank of India",             exchange: "NSE" },
  { symbol: "HINDUNILVR",   name: "Hindustan Unilever",              exchange: "NSE" },
  { symbol: "ITC",          name: "ITC Ltd",                         exchange: "NSE" },
  { symbol: "LT",           name: "Larsen & Toubro",                 exchange: "NSE" },
  { symbol: "KOTAKBANK",    name: "Kotak Mahindra Bank",             exchange: "NSE" },
  { symbol: "AXISBANK",     name: "Axis Bank",                       exchange: "NSE" },
  { symbol: "BAJFINANCE",   name: "Bajaj Finance",                   exchange: "NSE" },
  { symbol: "MARUTI",       name: "Maruti Suzuki India",             exchange: "NSE" },
  { symbol: "ASIANPAINT",   name: "Asian Paints",                    exchange: "NSE" },
  { symbol: "SUNPHARMA",    name: "Sun Pharmaceutical Industries",   exchange: "NSE" },
  { symbol: "TITAN",        name: "Titan Company",                   exchange: "NSE" },
  { symbol: "WIPRO",        name: "Wipro",                           exchange: "NSE" },
  { symbol: "ONGC",         name: "Oil & Natural Gas Corporation",   exchange: "NSE" },
  { symbol: "NTPC",         name: "NTPC",                            exchange: "NSE" },
  { symbol: "POWERGRID",    name: "Power Grid Corporation",          exchange: "NSE" },
  { symbol: "HCLTECH",      name: "HCL Technologies",                exchange: "NSE" },
  { symbol: "TECHM",        name: "Tech Mahindra",                   exchange: "NSE" },
  { symbol: "ULTRACEMCO",   name: "UltraTech Cement",                exchange: "NSE" },
  { symbol: "NESTLEIND",    name: "Nestle India",                    exchange: "NSE" },
  { symbol: "BAJAJFINSV",   name: "Bajaj Finserv",                   exchange: "NSE" },
  { symbol: "JSWSTEEL",     name: "JSW Steel",                       exchange: "NSE" },
  { symbol: "TATASTEEL",    name: "Tata Steel",                      exchange: "NSE" },
  { symbol: "TATAMOTORS",   name: "Tata Motors",                     exchange: "NSE" },
  { symbol: "ADANIENT",     name: "Adani Enterprises",               exchange: "NSE" },
  { symbol: "ADANIPORTS",   name: "Adani Ports & SEZ",               exchange: "NSE" },
  { symbol: "ADANIPOWER",   name: "Adani Power",                     exchange: "NSE" },
  { symbol: "ADANIGREEN",   name: "Adani Green Energy",              exchange: "NSE" },
  { symbol: "COALINDIA",    name: "Coal India",                      exchange: "NSE" },
  { symbol: "DRREDDY",      name: "Dr Reddy's Laboratories",         exchange: "NSE" },
  { symbol: "CIPLA",        name: "Cipla",                           exchange: "NSE" },
  { symbol: "DIVISLAB",     name: "Divi's Laboratories",             exchange: "NSE" },
  { symbol: "APOLLOHOSP",   name: "Apollo Hospitals Enterprise",     exchange: "NSE" },
  { symbol: "EICHERMOT",    name: "Eicher Motors",                   exchange: "NSE" },
  { symbol: "HEROMOTOCO",   name: "Hero MotoCorp",                   exchange: "NSE" },
  { symbol: "HINDALCO",     name: "Hindalco Industries",             exchange: "NSE" },
  { symbol: "GRASIM",       name: "Grasim Industries",               exchange: "NSE" },
  { symbol: "INDUSINDBK",   name: "IndusInd Bank",                   exchange: "NSE" },
  { symbol: "BRITANNIA",    name: "Britannia Industries",            exchange: "NSE" },
  { symbol: "BPCL",         name: "Bharat Petroleum Corporation",    exchange: "NSE" },
  { symbol: "TATACONSUM",   name: "Tata Consumer Products",          exchange: "NSE" },
  { symbol: "SBILIFE",      name: "SBI Life Insurance",              exchange: "NSE" },
  { symbol: "HDFCLIFE",     name: "HDFC Life Insurance",             exchange: "NSE" },
  { symbol: "ICICIPRULI",   name: "ICICI Prudential Life Insurance", exchange: "NSE" },
  { symbol: "SHREECEM",     name: "Shree Cement",                    exchange: "NSE" },
  { symbol: "UPL",          name: "UPL",                             exchange: "NSE" },
  { symbol: "M&M",          name: "Mahindra & Mahindra",             exchange: "NSE" },
  { symbol: "MARICO",       name: "Marico",                          exchange: "NSE" },
  { symbol: "DABUR",        name: "Dabur India",                     exchange: "NSE" },
  { symbol: "GODREJCP",     name: "Godrej Consumer Products",        exchange: "NSE" },
  { symbol: "PIDILITIND",   name: "Pidilite Industries",             exchange: "NSE" },
  { symbol: "HAVELLS",      name: "Havells India",                   exchange: "NSE" },
  { symbol: "BERGEPAINT",   name: "Berger Paints India",             exchange: "NSE" },
  { symbol: "COLPAL",       name: "Colgate-Palmolive India",         exchange: "NSE" },
  { symbol: "MCDOWELL-N",   name: "United Spirits",                  exchange: "NSE" },
  { symbol: "HAL",          name: "Hindustan Aeronautics",           exchange: "NSE" },
  { symbol: "BEL",          name: "Bharat Electronics",              exchange: "NSE" },
  { symbol: "SAIL",         name: "Steel Authority of India",        exchange: "NSE" },
  { symbol: "NMDC",         name: "NMDC",                            exchange: "NSE" },
  { symbol: "GAIL",         name: "GAIL India",                      exchange: "NSE" },
  { symbol: "IOC",          name: "Indian Oil Corporation",          exchange: "NSE" },
  { symbol: "VEDL",         name: "Vedanta",                         exchange: "NSE" },
  { symbol: "ZOMATO",       name: "Zomato",                          exchange: "NSE" },
  { symbol: "NYKAA",        name: "FSN E-Commerce (Nykaa)",          exchange: "NSE" },
  { symbol: "PAYTM",        name: "One 97 Communications (Paytm)",   exchange: "NSE" },
  { symbol: "DMART",        name: "Avenue Supermarts (DMart)",       exchange: "NSE" },
  { symbol: "IRCTC",        name: "Indian Railway Catering (IRCTC)", exchange: "NSE" },
  { symbol: "PERSISTENT",   name: "Persistent Systems",              exchange: "NSE" },
  { symbol: "COFORGE",      name: "Coforge",                         exchange: "NSE" },
  { symbol: "MPHASIS",      name: "Mphasis",                         exchange: "NSE" },
  { symbol: "LTIM",         name: "LTIMindtree",                     exchange: "NSE" },
  { symbol: "MUTHOOTFIN",   name: "Muthoot Finance",                 exchange: "NSE" },
  { symbol: "CHOLAFIN",     name: "Cholamandalam Investment",        exchange: "NSE" },
  { symbol: "BAJAJ-AUTO",   name: "Bajaj Auto",                      exchange: "NSE" },
  { symbol: "TATAPOWER",    name: "Tata Power Company",              exchange: "NSE" },
  { symbol: "TORNTPHARM",   name: "Torrent Pharmaceuticals",         exchange: "NSE" },
  { symbol: "BIOCON",       name: "Biocon",                          exchange: "NSE" },
  { symbol: "LUPIN",        name: "Lupin",                           exchange: "NSE" },
  { symbol: "AUROPHARMA",   name: "Aurobindo Pharma",                exchange: "NSE" },
  { symbol: "ALKEM",        name: "Alkem Laboratories",              exchange: "NSE" },
  { symbol: "IPCALAB",      name: "IPCA Laboratories",               exchange: "NSE" },
  { symbol: "INDHOTEL",     name: "Indian Hotels Company",           exchange: "NSE" },
  { symbol: "JUBLFOOD",     name: "Jubilant Foodworks",              exchange: "NSE" },
  { symbol: "PAGEIND",      name: "Page Industries",                 exchange: "NSE" },
  { symbol: "VOLTAS",       name: "Voltas",                          exchange: "NSE" },
  { symbol: "AMBUJACEM",    name: "Ambuja Cements",                  exchange: "NSE" },
  { symbol: "ACC",          name: "ACC",                             exchange: "NSE" },
  { symbol: "SIEMENS",      name: "Siemens",                         exchange: "NSE" },
  { symbol: "ABB",          name: "ABB India",                       exchange: "NSE" },
  { symbol: "BOSCHLTD",     name: "Bosch",                           exchange: "NSE" },
  { symbol: "CUMMINSIND",   name: "Cummins India",                   exchange: "NSE" },
  { symbol: "THERMAX",      name: "Thermax",                         exchange: "NSE" },
  { symbol: "BANKBARODA",   name: "Bank of Baroda",                  exchange: "NSE" },
  { symbol: "PNB",          name: "Punjab National Bank",            exchange: "NSE" },
  { symbol: "CANBK",        name: "Canara Bank",                     exchange: "NSE" },
  { symbol: "FEDERALBNK",   name: "Federal Bank",                    exchange: "NSE" },
  { symbol: "IDFCFIRSTB",   name: "IDFC First Bank",                 exchange: "NSE" },
];

/**
 * Instantly filters Nifty 100 by query.
 * Matches symbol prefix first, then name contains.
 * Returns up to `limit` results.
 */
export function searchNifty100(query: string, limit = 5): NseStock[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  // Symbol starts-with matches first (higher relevance)
  const prefixMatches = NIFTY_100.filter(s => s.symbol.startsWith(q));

  // Then name contains (lower relevance)
  const nameMatches = NIFTY_100.filter(
    s => !s.symbol.startsWith(q) && s.name.toUpperCase().includes(q)
  );

  return [...prefixMatches, ...nameMatches].slice(0, limit);
}