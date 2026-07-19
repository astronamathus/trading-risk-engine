// ============================================================
// lib/stockList.ts
// Local stock lists for instant search — no API call needed.
// Covers Nifty 500 (INR) + S&P 500 / popular NASDAQ (USD).
// ============================================================

export interface StockEntry {
  symbol:   string;
  name:     string;
  exchange: "NSE" | "BSE" | "NYSE" | "NASDAQ";
  market:   "INR" | "USD";
}

// ── Indian stocks (NSE/BSE) ───────────────────────────────────
const INDIA_STOCKS: StockEntry[] = [
  // Nifty 50
  { symbol: "RELIANCE",    name: "Reliance Industries",          exchange: "NSE", market: "INR" },
  { symbol: "TCS",         name: "Tata Consultancy Services",    exchange: "NSE", market: "INR" },
  { symbol: "HDFCBANK",    name: "HDFC Bank",                    exchange: "NSE", market: "INR" },
  { symbol: "ICICIBANK",   name: "ICICI Bank",                   exchange: "NSE", market: "INR" },
  { symbol: "INFY",        name: "Infosys",                      exchange: "NSE", market: "INR" },
  { symbol: "HINDUNILVR",  name: "Hindustan Unilever",           exchange: "NSE", market: "INR" },
  { symbol: "ITC",         name: "ITC Limited",                  exchange: "NSE", market: "INR" },
  { symbol: "SBIN",        name: "State Bank of India",          exchange: "NSE", market: "INR" },
  { symbol: "BHARTIARTL",  name: "Bharti Airtel",                exchange: "NSE", market: "INR" },
  { symbol: "KOTAKBANK",   name: "Kotak Mahindra Bank",          exchange: "NSE", market: "INR" },
  { symbol: "LT",          name: "Larsen & Toubro",              exchange: "NSE", market: "INR" },
  { symbol: "HCLTECH",     name: "HCL Technologies",             exchange: "NSE", market: "INR" },
  { symbol: "AXISBANK",    name: "Axis Bank",                    exchange: "NSE", market: "INR" },
  { symbol: "ASIANPAINT",  name: "Asian Paints",                 exchange: "NSE", market: "INR" },
  { symbol: "MARUTI",      name: "Maruti Suzuki",                exchange: "NSE", market: "INR" },
  { symbol: "SUNPHARMA",   name: "Sun Pharmaceutical",           exchange: "NSE", market: "INR" },
  { symbol: "TITAN",       name: "Titan Company",                exchange: "NSE", market: "INR" },
  { symbol: "BAJFINANCE",  name: "Bajaj Finance",                exchange: "NSE", market: "INR" },
  { symbol: "WIPRO",       name: "Wipro",                        exchange: "NSE", market: "INR" },
  { symbol: "NESTLEIND",   name: "Nestle India",                 exchange: "NSE", market: "INR" },
  { symbol: "ULTRACEMCO",  name: "UltraTech Cement",             exchange: "NSE", market: "INR" },
  { symbol: "POWERGRID",   name: "Power Grid Corporation",       exchange: "NSE", market: "INR" },
  { symbol: "NTPC",        name: "NTPC Limited",                 exchange: "NSE", market: "INR" },
  { symbol: "TECHM",       name: "Tech Mahindra",                exchange: "NSE", market: "INR" },
  { symbol: "BAJAJFINSV",  name: "Bajaj Finserv",                exchange: "NSE", market: "INR" },
  { symbol: "ONGC",        name: "Oil & Natural Gas Corporation", exchange: "NSE", market: "INR" },
  { symbol: "TATAMOTORS",  name: "Tata Motors",                  exchange: "NSE", market: "INR" },
  { symbol: "TATASTEEL",   name: "Tata Steel",                   exchange: "NSE", market: "INR" },
  { symbol: "INDUSINDBK",  name: "IndusInd Bank",                exchange: "NSE", market: "INR" },
  { symbol: "ADANIPORTS",  name: "Adani Ports",                  exchange: "NSE", market: "INR" },
  { symbol: "GRASIM",      name: "Grasim Industries",            exchange: "NSE", market: "INR" },
  { symbol: "JSWSTEEL",    name: "JSW Steel",                    exchange: "NSE", market: "INR" },
  { symbol: "DRREDDY",     name: "Dr. Reddy's Laboratories",     exchange: "NSE", market: "INR" },
  { symbol: "CIPLA",       name: "Cipla",                        exchange: "NSE", market: "INR" },
  { symbol: "EICHERMOT",   name: "Eicher Motors",                exchange: "NSE", market: "INR" },
  { symbol: "HINDALCO",    name: "Hindalco Industries",          exchange: "NSE", market: "INR" },
  { symbol: "HEROMOTOCO",  name: "Hero MotoCorp",                exchange: "NSE", market: "INR" },
  { symbol: "DIVISLAB",    name: "Divi's Laboratories",          exchange: "NSE", market: "INR" },
  { symbol: "COALINDIA",   name: "Coal India",                   exchange: "NSE", market: "INR" },
  { symbol: "BPCL",        name: "Bharat Petroleum",             exchange: "NSE", market: "INR" },
  { symbol: "APOLLOHOSP",  name: "Apollo Hospitals",             exchange: "NSE", market: "INR" },
  { symbol: "TATACONSUM",  name: "Tata Consumer Products",       exchange: "NSE", market: "INR" },
  { symbol: "BRITANNIA",   name: "Britannia Industries",         exchange: "NSE", market: "INR" },
  { symbol: "SBILIFE",     name: "SBI Life Insurance",           exchange: "NSE", market: "INR" },
  { symbol: "HDFCLIFE",    name: "HDFC Life Insurance",          exchange: "NSE", market: "INR" },
  // Nifty Next 50 / popular midcaps
  { symbol: "CANBK",       name: "Canara Bank",                  exchange: "NSE", market: "INR" },
  { symbol: "BANKBARODA",  name: "Bank of Baroda",               exchange: "NSE", market: "INR" },
  { symbol: "PFC",         name: "Power Finance Corporation",    exchange: "NSE", market: "INR" },
  { symbol: "RECLTD",      name: "REC Limited",                  exchange: "NSE", market: "INR" },
  { symbol: "SIEMENS",     name: "Siemens India",                exchange: "NSE", market: "INR" },
  { symbol: "HAL",         name: "Hindustan Aeronautics",        exchange: "NSE", market: "INR" },
  { symbol: "DLF",         name: "DLF Limited",                  exchange: "NSE", market: "INR" },
  { symbol: "BAJAJ-AUTO",  name: "Bajaj Auto",                   exchange: "NSE", market: "INR" },
  { symbol: "VEDL",        name: "Vedanta",                      exchange: "NSE", market: "INR" },
  { symbol: "SAIL",        name: "Steel Authority of India",     exchange: "NSE", market: "INR" },
  { symbol: "NMDC",        name: "NMDC Limited",                 exchange: "NSE", market: "INR" },
  { symbol: "ZOMATO",      name: "Zomato",                       exchange: "NSE", market: "INR" },
  { symbol: "NYKAA",       name: "FSN E-Commerce (Nykaa)",       exchange: "NSE", market: "INR" },
  { symbol: "PAYTM",       name: "One97 Communications (Paytm)", exchange: "NSE", market: "INR" },
  { symbol: "IRCTC",       name: "IRCTC",                        exchange: "NSE", market: "INR" },
  { symbol: "RVNL",        name: "Rail Vikas Nigam",             exchange: "NSE", market: "INR" },
  { symbol: "IRFC",        name: "Indian Railway Finance Corp",  exchange: "NSE", market: "INR" },
  { symbol: "HUDCO",       name: "Housing & Urban Dev Corp",     exchange: "NSE", market: "INR" },
  { symbol: "LTIM",        name: "LTIMindtree",                  exchange: "NSE", market: "INR" },
  { symbol: "ABCAPITAL",   name: "Aditya Birla Capital",         exchange: "NSE", market: "INR" },
  { symbol: "TATAPOWER",   name: "Tata Power",                   exchange: "NSE", market: "INR" },
  { symbol: "ADANIENT",    name: "Adani Enterprises",            exchange: "NSE", market: "INR" },
  { symbol: "ADANIGREEN",  name: "Adani Green Energy",           exchange: "NSE", market: "INR" },
];

// ── US stocks (NYSE/NASDAQ) ───────────────────────────────────
const US_STOCKS: StockEntry[] = [
  // Mega caps
  { symbol: "AAPL",   name: "Apple Inc.",                      exchange: "NASDAQ", market: "USD" },
  { symbol: "MSFT",   name: "Microsoft Corporation",           exchange: "NASDAQ", market: "USD" },
  { symbol: "NVDA",   name: "NVIDIA Corporation",              exchange: "NASDAQ", market: "USD" },
  { symbol: "AMZN",   name: "Amazon.com Inc.",                 exchange: "NASDAQ", market: "USD" },
  { symbol: "GOOGL",  name: "Alphabet Inc. (Class A)",         exchange: "NASDAQ", market: "USD" },
  { symbol: "GOOG",   name: "Alphabet Inc. (Class C)",         exchange: "NASDAQ", market: "USD" },
  { symbol: "META",   name: "Meta Platforms Inc.",             exchange: "NASDAQ", market: "USD" },
  { symbol: "TSLA",   name: "Tesla Inc.",                      exchange: "NASDAQ", market: "USD" },
  { symbol: "BRK.B",  name: "Berkshire Hathaway (Class B)",   exchange: "NYSE",   market: "USD" },
  { symbol: "JPM",    name: "JPMorgan Chase & Co.",            exchange: "NYSE",   market: "USD" },
  { symbol: "V",      name: "Visa Inc.",                       exchange: "NYSE",   market: "USD" },
  { symbol: "UNH",    name: "UnitedHealth Group",              exchange: "NYSE",   market: "USD" },
  { symbol: "XOM",    name: "Exxon Mobil Corporation",         exchange: "NYSE",   market: "USD" },
  { symbol: "LLY",    name: "Eli Lilly and Company",           exchange: "NYSE",   market: "USD" },
  { symbol: "JNJ",    name: "Johnson & Johnson",               exchange: "NYSE",   market: "USD" },
  { symbol: "MA",     name: "Mastercard Inc.",                 exchange: "NYSE",   market: "USD" },
  { symbol: "AVGO",   name: "Broadcom Inc.",                   exchange: "NASDAQ", market: "USD" },
  { symbol: "PG",     name: "Procter & Gamble",                exchange: "NYSE",   market: "USD" },
  { symbol: "HD",     name: "Home Depot Inc.",                 exchange: "NYSE",   market: "USD" },
  { symbol: "MRK",    name: "Merck & Co.",                     exchange: "NYSE",   market: "USD" },
  { symbol: "CVX",    name: "Chevron Corporation",             exchange: "NYSE",   market: "USD" },
  { symbol: "ABBV",   name: "AbbVie Inc.",                     exchange: "NYSE",   market: "USD" },
  { symbol: "KO",     name: "Coca-Cola Company",               exchange: "NYSE",   market: "USD" },
  { symbol: "PEP",    name: "PepsiCo Inc.",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "COST",   name: "Costco Wholesale",                exchange: "NASDAQ", market: "USD" },
  { symbol: "WMT",    name: "Walmart Inc.",                    exchange: "NYSE",   market: "USD" },
  { symbol: "BAC",    name: "Bank of America",                 exchange: "NYSE",   market: "USD" },
  { symbol: "MCD",    name: "McDonald's Corporation",          exchange: "NYSE",   market: "USD" },
  { symbol: "CSCO",   name: "Cisco Systems",                   exchange: "NASDAQ", market: "USD" },
  { symbol: "CRM",    name: "Salesforce Inc.",                 exchange: "NYSE",   market: "USD" },
  { symbol: "TMO",    name: "Thermo Fisher Scientific",        exchange: "NYSE",   market: "USD" },
  { symbol: "ABT",    name: "Abbott Laboratories",             exchange: "NYSE",   market: "USD" },
  { symbol: "ACN",    name: "Accenture plc",                   exchange: "NYSE",   market: "USD" },
  { symbol: "WFC",    name: "Wells Fargo & Co.",               exchange: "NYSE",   market: "USD" },
  { symbol: "NFLX",   name: "Netflix Inc.",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "AMD",    name: "Advanced Micro Devices",          exchange: "NASDAQ", market: "USD" },
  { symbol: "INTC",   name: "Intel Corporation",               exchange: "NASDAQ", market: "USD" },
  { symbol: "QCOM",   name: "Qualcomm Inc.",                   exchange: "NASDAQ", market: "USD" },
  { symbol: "ORCL",   name: "Oracle Corporation",              exchange: "NYSE",   market: "USD" },
  { symbol: "IBM",    name: "IBM Corporation",                 exchange: "NYSE",   market: "USD" },
  { symbol: "GE",     name: "GE Aerospace",                    exchange: "NYSE",   market: "USD" },
  { symbol: "CAT",    name: "Caterpillar Inc.",                exchange: "NYSE",   market: "USD" },
  { symbol: "BA",     name: "Boeing Company",                  exchange: "NYSE",   market: "USD" },
  { symbol: "GS",     name: "Goldman Sachs Group",             exchange: "NYSE",   market: "USD" },
  { symbol: "MS",     name: "Morgan Stanley",                  exchange: "NYSE",   market: "USD" },
  { symbol: "SPGI",   name: "S&P Global Inc.",                 exchange: "NYSE",   market: "USD" },
  { symbol: "BLK",    name: "BlackRock Inc.",                  exchange: "NYSE",   market: "USD" },
  { symbol: "PYPL",   name: "PayPal Holdings",                 exchange: "NASDAQ", market: "USD" },
  { symbol: "SQ",     name: "Block Inc.",                      exchange: "NYSE",   market: "USD" },
  { symbol: "COIN",   name: "Coinbase Global",                 exchange: "NASDAQ", market: "USD" },
  { symbol: "SHOP",   name: "Shopify Inc.",                    exchange: "NYSE",   market: "USD" },
  { symbol: "UBER",   name: "Uber Technologies",               exchange: "NYSE",   market: "USD" },
  { symbol: "LYFT",   name: "Lyft Inc.",                       exchange: "NASDAQ", market: "USD" },
  { symbol: "SNAP",   name: "Snap Inc.",                       exchange: "NYSE",   market: "USD" },
  { symbol: "PINS",   name: "Pinterest Inc.",                  exchange: "NYSE",   market: "USD" },
  { symbol: "SPOT",   name: "Spotify Technology",              exchange: "NYSE",   market: "USD" },
  { symbol: "HOOD",   name: "Robinhood Markets",               exchange: "NASDAQ", market: "USD" },
  { symbol: "PLTR",   name: "Palantir Technologies",           exchange: "NASDAQ", market: "USD" },
  { symbol: "RBLX",   name: "Roblox Corporation",              exchange: "NYSE",   market: "USD" },
  { symbol: "U",      name: "Unity Software",                  exchange: "NYSE",   market: "USD" },
  { symbol: "RIVN",   name: "Rivian Automotive",               exchange: "NASDAQ", market: "USD" },
  { symbol: "LCID",   name: "Lucid Group",                     exchange: "NASDAQ", market: "USD" },
  { symbol: "NIO",    name: "NIO Inc.",                        exchange: "NYSE",   market: "USD" },
  { symbol: "XPEV",   name: "XPeng Inc.",                      exchange: "NYSE",   market: "USD" },
  { symbol: "F",      name: "Ford Motor Company",              exchange: "NYSE",   market: "USD" },
  { symbol: "GM",     name: "General Motors",                  exchange: "NYSE",   market: "USD" },
  { symbol: "DIS",    name: "Walt Disney Company",             exchange: "NYSE",   market: "USD" },
  { symbol: "CMCSA",  name: "Comcast Corporation",             exchange: "NASDAQ", market: "USD" },
  { symbol: "T",      name: "AT&T Inc.",                       exchange: "NYSE",   market: "USD" },
  { symbol: "VZ",     name: "Verizon Communications",          exchange: "NYSE",   market: "USD" },
  { symbol: "TMUS",   name: "T-Mobile US",                     exchange: "NASDAQ", market: "USD" },
  { symbol: "AMGN",   name: "Amgen Inc.",                      exchange: "NASDAQ", market: "USD" },
  { symbol: "GILD",   name: "Gilead Sciences",                 exchange: "NASDAQ", market: "USD" },
  { symbol: "BIIB",   name: "Biogen Inc.",                     exchange: "NASDAQ", market: "USD" },
  { symbol: "MRNA",   name: "Moderna Inc.",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "PFE",    name: "Pfizer Inc.",                     exchange: "NYSE",   market: "USD" },
  { symbol: "ZM",     name: "Zoom Video Communications",       exchange: "NASDAQ", market: "USD" },
  { symbol: "DOCU",   name: "DocuSign Inc.",                   exchange: "NASDAQ", market: "USD" },
  { symbol: "SNOW",   name: "Snowflake Inc.",                  exchange: "NYSE",   market: "USD" },
  { symbol: "DDOG",   name: "Datadog Inc.",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "NET",    name: "Cloudflare Inc.",                 exchange: "NYSE",   market: "USD" },
  { symbol: "MDB",    name: "MongoDB Inc.",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "CRWD",   name: "CrowdStrike Holdings",            exchange: "NASDAQ", market: "USD" },
  { symbol: "ZS",     name: "Zscaler Inc.",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "OKTA",   name: "Okta Inc.",                       exchange: "NASDAQ", market: "USD" },
  { symbol: "ANET",   name: "Arista Networks",                 exchange: "NYSE",   market: "USD" },
  { symbol: "NOW",    name: "ServiceNow Inc.",                 exchange: "NYSE",   market: "USD" },
  { symbol: "WDAY",   name: "Workday Inc.",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "TTD",    name: "The Trade Desk",                  exchange: "NASDAQ", market: "USD" },
  { symbol: "APP",    name: "Applovin Corporation",            exchange: "NASDAQ", market: "USD" },
  { symbol: "SMCI",   name: "Super Micro Computer",            exchange: "NASDAQ", market: "USD" },
  { symbol: "ARM",    name: "Arm Holdings",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "ASML",   name: "ASML Holding",                    exchange: "NASDAQ", market: "USD" },
  { symbol: "TSM",    name: "Taiwan Semiconductor (ADR)",      exchange: "NYSE",   market: "USD" },
  { symbol: "SPY",    name: "SPDR S&P 500 ETF",               exchange: "NYSE",   market: "USD" },
  { symbol: "QQQ",    name: "Invesco QQQ Trust (NASDAQ ETF)",  exchange: "NASDAQ", market: "USD" },
  { symbol: "IWM",    name: "iShares Russell 2000 ETF",        exchange: "NYSE",   market: "USD" },
  { symbol: "VTI",    name: "Vanguard Total Stock Market ETF", exchange: "NYSE",   market: "USD" },
];

export const STOCK_LIST: StockEntry[] = [...INDIA_STOCKS, ...US_STOCKS];

// ── Search ───────────────────────────────────────────────────
export function searchStocks(query: string, limit = 8, market?: "INR" | "USD"): StockEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  const pool = market ? STOCK_LIST.filter(s => s.market === market) : STOCK_LIST;

  return pool
    .filter(s =>
      s.symbol.includes(q) ||
      s.name.toUpperCase().includes(q)
    )
    .sort((a, b) => {
      const aSymbol = a.symbol.startsWith(q) ? 0 : 1;
      const bSymbol = b.symbol.startsWith(q) ? 0 : 1;
      return aSymbol - bSymbol;
    })
    .slice(0, limit);
}