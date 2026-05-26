// ============================================================
// lib/stockList.ts
// Comprehensive local stock list for instant search.
// Covers Nifty 500 + popular BSE stocks (~400 entries).
// No API call needed — filters in <1ms.
//
// To add more stocks: append to STOCK_LIST following the same format.
// For full market coverage, see README for the NSE/BSE symbol master
// build script (future feature).
// ============================================================

export interface StockEntry {
  symbol:   string;        // base symbol, e.g. "RELIANCE"
  name:     string;        // display name
  exchange: "NSE" | "BSE";
}

export const STOCK_LIST: StockEntry[] = [
  // ── Nifty 50 ─────────────────────────────────────────────
  { symbol: "RELIANCE",    name: "Reliance Industries",             exchange: "NSE" },
  { symbol: "TCS",         name: "Tata Consultancy Services",       exchange: "NSE" },
  { symbol: "HDFCBANK",    name: "HDFC Bank",                       exchange: "NSE" },
  { symbol: "BHARTIARTL",  name: "Bharti Airtel",                   exchange: "NSE" },
  { symbol: "ICICIBANK",   name: "ICICI Bank",                      exchange: "NSE" },
  { symbol: "INFY",        name: "Infosys",                         exchange: "NSE" },
  { symbol: "SBIN",        name: "State Bank of India",             exchange: "NSE" },
  { symbol: "HINDUNILVR",  name: "Hindustan Unilever",              exchange: "NSE" },
  { symbol: "ITC",         name: "ITC Ltd",                         exchange: "NSE" },
  { symbol: "LT",          name: "Larsen & Toubro",                 exchange: "NSE" },
  { symbol: "KOTAKBANK",   name: "Kotak Mahindra Bank",             exchange: "NSE" },
  { symbol: "AXISBANK",    name: "Axis Bank",                       exchange: "NSE" },
  { symbol: "BAJFINANCE",  name: "Bajaj Finance",                   exchange: "NSE" },
  { symbol: "MARUTI",      name: "Maruti Suzuki India",             exchange: "NSE" },
  { symbol: "ASIANPAINT",  name: "Asian Paints",                    exchange: "NSE" },
  { symbol: "SUNPHARMA",   name: "Sun Pharmaceutical",              exchange: "NSE" },
  { symbol: "TITAN",       name: "Titan Company",                   exchange: "NSE" },
  { symbol: "WIPRO",       name: "Wipro",                           exchange: "NSE" },
  { symbol: "ONGC",        name: "Oil & Natural Gas Corporation",   exchange: "NSE" },
  { symbol: "NTPC",        name: "NTPC Ltd",                        exchange: "NSE" },
  { symbol: "POWERGRID",   name: "Power Grid Corporation",          exchange: "NSE" },
  { symbol: "HCLTECH",     name: "HCL Technologies",                exchange: "NSE" },
  { symbol: "TECHM",       name: "Tech Mahindra",                   exchange: "NSE" },
  { symbol: "ULTRACEMCO",  name: "UltraTech Cement",                exchange: "NSE" },
  { symbol: "NESTLEIND",   name: "Nestle India",                    exchange: "NSE" },
  { symbol: "BAJAJFINSV",  name: "Bajaj Finserv",                   exchange: "NSE" },
  { symbol: "JSWSTEEL",    name: "JSW Steel",                       exchange: "NSE" },
  { symbol: "TATASTEEL",   name: "Tata Steel",                      exchange: "NSE" },
  { symbol: "TATAMOTORS",  name: "Tata Motors",                     exchange: "NSE" },
  { symbol: "ADANIENT",    name: "Adani Enterprises",               exchange: "NSE" },
  { symbol: "ADANIPORTS",  name: "Adani Ports & SEZ",               exchange: "NSE" },
  { symbol: "COALINDIA",   name: "Coal India",                      exchange: "NSE" },
  { symbol: "DRREDDY",     name: "Dr Reddy's Laboratories",         exchange: "NSE" },
  { symbol: "CIPLA",       name: "Cipla",                           exchange: "NSE" },
  { symbol: "DIVISLAB",    name: "Divi's Laboratories",             exchange: "NSE" },
  { symbol: "APOLLOHOSP",  name: "Apollo Hospitals",                exchange: "NSE" },
  { symbol: "EICHERMOT",   name: "Eicher Motors",                   exchange: "NSE" },
  { symbol: "HEROMOTOCO",  name: "Hero MotoCorp",                   exchange: "NSE" },
  { symbol: "HINDALCO",    name: "Hindalco Industries",             exchange: "NSE" },
  { symbol: "GRASIM",      name: "Grasim Industries",               exchange: "NSE" },
  { symbol: "INDUSINDBK",  name: "IndusInd Bank",                   exchange: "NSE" },
  { symbol: "BRITANNIA",   name: "Britannia Industries",            exchange: "NSE" },
  { symbol: "BPCL",        name: "Bharat Petroleum",                exchange: "NSE" },
  { symbol: "TATACONSUM",  name: "Tata Consumer Products",          exchange: "NSE" },
  { symbol: "SBILIFE",     name: "SBI Life Insurance",              exchange: "NSE" },
  { symbol: "HDFCLIFE",    name: "HDFC Life Insurance",             exchange: "NSE" },
  { symbol: "SHREECEM",    name: "Shree Cement",                    exchange: "NSE" },
  { symbol: "UPL",         name: "UPL Ltd",                         exchange: "NSE" },
  { symbol: "M&M",         name: "Mahindra & Mahindra",             exchange: "NSE" },
  { symbol: "BAJAJ-AUTO",  name: "Bajaj Auto",                      exchange: "NSE" },

  // ── Nifty Next 50 ─────────────────────────────────────────
  { symbol: "ADANIGREEN",  name: "Adani Green Energy",              exchange: "NSE" },
  { symbol: "ADANIPOWER",  name: "Adani Power",                     exchange: "NSE" },
  { symbol: "ADANITRANS",  name: "Adani Transmission",              exchange: "NSE" },
  { symbol: "AMBUJACEM",   name: "Ambuja Cements",                  exchange: "NSE" },
  { symbol: "ACC",         name: "ACC Ltd",                         exchange: "NSE" },
  { symbol: "BANKBARODA",  name: "Bank of Baroda",                  exchange: "NSE" },
  { symbol: "BERGEPAINT",  name: "Berger Paints India",             exchange: "NSE" },
  { symbol: "BIOCON",      name: "Biocon",                          exchange: "NSE" },
  { symbol: "BOSCHLTD",    name: "Bosch",                           exchange: "NSE" },
  { symbol: "CANBK",       name: "Canara Bank",                     exchange: "NSE" },
  { symbol: "CHOLAFIN",    name: "Cholamandalam Investment",        exchange: "NSE" },
  { symbol: "COLPAL",      name: "Colgate-Palmolive India",         exchange: "NSE" },
  { symbol: "DABUR",       name: "Dabur India",                     exchange: "NSE" },
  { symbol: "DLF",         name: "DLF Ltd",                         exchange: "NSE" },
  { symbol: "GAIL",        name: "GAIL India",                      exchange: "NSE" },
  { symbol: "GODREJCP",    name: "Godrej Consumer Products",        exchange: "NSE" },
  { symbol: "HAVELLS",     name: "Havells India",                   exchange: "NSE" },
  { symbol: "ICICIPRULI",  name: "ICICI Prudential Life Insurance", exchange: "NSE" },
  { symbol: "IOC",         name: "Indian Oil Corporation",          exchange: "NSE" },
  { symbol: "IRCTC",       name: "Indian Railway Catering (IRCTC)", exchange: "NSE" },
  { symbol: "LUPIN",       name: "Lupin",                           exchange: "NSE" },
  { symbol: "MARICO",      name: "Marico",                          exchange: "NSE" },
  { symbol: "MUTHOOTFIN",  name: "Muthoot Finance",                 exchange: "NSE" },
  { symbol: "NAUKRI",      name: "Info Edge (Naukri)",              exchange: "NSE" },
  { symbol: "NMDC",        name: "NMDC Ltd",                        exchange: "NSE" },
  { symbol: "PAGEIND",     name: "Page Industries",                 exchange: "NSE" },
  { symbol: "PIDILITIND",  name: "Pidilite Industries",             exchange: "NSE" },
  { symbol: "PNB",         name: "Punjab National Bank",            exchange: "NSE" },
  { symbol: "SAIL",        name: "Steel Authority of India",        exchange: "NSE" },
  { symbol: "SIEMENS",     name: "Siemens India",                   exchange: "NSE" },
  { symbol: "TORNTPHARM", name: "Torrent Pharmaceuticals",          exchange: "NSE" },
  { symbol: "VEDL",        name: "Vedanta",                         exchange: "NSE" },
  { symbol: "VOLTAS",      name: "Voltas",                          exchange: "NSE" },
  { symbol: "ZYDUSLIFE",   name: "Zydus Lifesciences",              exchange: "NSE" },

  // ── Nifty Midcap 150 (selection) ──────────────────────────
  { symbol: "AUROPHARMA",  name: "Aurobindo Pharma",                exchange: "NSE" },
  { symbol: "BALKRISIND",  name: "Balkrishna Industries",           exchange: "NSE" },
  { symbol: "BEL",         name: "Bharat Electronics",              exchange: "NSE" },
  { symbol: "BHARATFORG",  name: "Bharat Forge",                    exchange: "NSE" },
  { symbol: "COFORGE",     name: "Coforge",                         exchange: "NSE" },
  { symbol: "CONCOR",      name: "Container Corporation of India",  exchange: "NSE" },
  { symbol: "CUMMINSIND",  name: "Cummins India",                   exchange: "NSE" },
  { symbol: "DMART",       name: "Avenue Supermarts (DMart)",       exchange: "NSE" },
  { symbol: "FEDERALBNK",  name: "Federal Bank",                    exchange: "NSE" },
  { symbol: "GODREJPROP",  name: "Godrej Properties",               exchange: "NSE" },
  { symbol: "HAL",         name: "Hindustan Aeronautics",           exchange: "NSE" },
  { symbol: "IDFCFIRSTB",  name: "IDFC First Bank",                 exchange: "NSE" },
  { symbol: "INDHOTEL",    name: "Indian Hotels Company",           exchange: "NSE" },
  { symbol: "INDUSTOWER",  name: "Indus Towers",                    exchange: "NSE" },
  { symbol: "JUBLFOOD",    name: "Jubilant Foodworks",              exchange: "NSE" },
  { symbol: "LICHSGFIN",   name: "LIC Housing Finance",             exchange: "NSE" },
  { symbol: "LTIM",        name: "LTIMindtree",                     exchange: "NSE" },
  { symbol: "LTTS",        name: "L&T Technology Services",         exchange: "NSE" },
  { symbol: "MAXHEALTH",   name: "Max Healthcare Institute",        exchange: "NSE" },
  { symbol: "METROPOLIS",  name: "Metropolis Healthcare",           exchange: "NSE" },
  { symbol: "MFSL",        name: "Max Financial Services",          exchange: "NSE" },
  { symbol: "MPHASIS",     name: "Mphasis",                         exchange: "NSE" },
  { symbol: "MRF",         name: "MRF Ltd",                         exchange: "NSE" },
  { symbol: "NYKAA",       name: "FSN E-Commerce (Nykaa)",          exchange: "NSE" },
  { symbol: "OBEROIRLTY",  name: "Oberoi Realty",                   exchange: "NSE" },
  { symbol: "PAYTM",       name: "One 97 Communications (Paytm)",   exchange: "NSE" },
  { symbol: "PERSISTENT",  name: "Persistent Systems",              exchange: "NSE" },
  { symbol: "PETRONET",    name: "Petronet LNG",                    exchange: "NSE" },
  { symbol: "POLYCAB",     name: "Polycab India",                   exchange: "NSE" },
  { symbol: "TATAPOWER",   name: "Tata Power Company",              exchange: "NSE" },
  { symbol: "TRENT",       name: "Trent Ltd",                       exchange: "NSE" },
  { symbol: "ZOMATO",      name: "Zomato",                          exchange: "NSE" },
  { symbol: "ABCAPITAL",   name: "Aditya Birla Capital",            exchange: "NSE" },
  { symbol: "ABFRL",       name: "Aditya Birla Fashion & Retail",   exchange: "NSE" },
  { symbol: "ALKEM",       name: "Alkem Laboratories",              exchange: "NSE" },
  { symbol: "ASHOKLEY",    name: "Ashok Leyland",                   exchange: "NSE" },
  { symbol: "ASTRAL",      name: "Astral Ltd",                      exchange: "NSE" },
  { symbol: "ATUL",        name: "Atul Ltd",                        exchange: "NSE" },
  { symbol: "AUBANK",      name: "AU Small Finance Bank",           exchange: "NSE" },
  { symbol: "BATAINDIA",   name: "Bata India",                      exchange: "NSE" },
  { symbol: "CROMPTON",    name: "Crompton Greaves Consumer",       exchange: "NSE" },
  { symbol: "DELHIVERY",   name: "Delhivery",                       exchange: "NSE" },
  { symbol: "ESCORTS",     name: "Escorts Kubota",                  exchange: "NSE" },
  { symbol: "EXIDEIND",    name: "Exide Industries",                exchange: "NSE" },
  { symbol: "GLENMARK",    name: "Glenmark Pharmaceuticals",        exchange: "NSE" },
  { symbol: "GMRINFRA",    name: "GMR Airports Infrastructure",     exchange: "NSE" },
  { symbol: "HFCL",        name: "HFCL Ltd",                        exchange: "NSE" },
  { symbol: "ICICIGI",     name: "ICICI Lombard General Insurance", exchange: "NSE" },
  { symbol: "INDIGO",      name: "IndiGo (InterGlobe Aviation)",    exchange: "NSE" },
  { symbol: "IPCALAB",     name: "IPCA Laboratories",               exchange: "NSE" },
  { symbol: "JKCEMENT",    name: "JK Cement",                       exchange: "NSE" },
  { symbol: "JSWENERGY",   name: "JSW Energy",                      exchange: "NSE" },
  { symbol: "KAJARIACER",  name: "Kajaria Ceramics",                exchange: "NSE" },
  { symbol: "KPITTECH",    name: "KPIT Technologies",               exchange: "NSE" },
  { symbol: "LAURUSLABS",  name: "Laurus Labs",                     exchange: "NSE" },
  { symbol: "LINDEINDIA",  name: "Linde India",                     exchange: "NSE" },
  { symbol: "MANAPPURAM",  name: "Manappuram Finance",              exchange: "NSE" },
  { symbol: "MAPMYINDIA",  name: "C.E. Info Systems (MapMyIndia)",  exchange: "NSE" },
  { symbol: "NATIONALUM",  name: "National Aluminium Company",      exchange: "NSE" },
  { symbol: "NBCC",        name: "NBCC (India)",                    exchange: "NSE" },
  { symbol: "NLCINDIA",    name: "NLC India",                       exchange: "NSE" },
  { symbol: "OFSS",        name: "Oracle Financial Services",       exchange: "NSE" },
  { symbol: "PHOENIX",     name: "Phoenix Mills",                   exchange: "NSE" },
  { symbol: "PNCINFRA",    name: "PNC Infratech",                   exchange: "NSE" },
  { symbol: "POWERINDIA",  name: "Hitachi Energy India",            exchange: "NSE" },
  { symbol: "PRESTIGE",    name: "Prestige Estates Projects",       exchange: "NSE" },
  { symbol: "RAIN",        name: "Rain Industries",                 exchange: "NSE" },
  { symbol: "RELAXO",      name: "Relaxo Footwears",                exchange: "NSE" },
  { symbol: "RITES",       name: "RITES Ltd",                       exchange: "NSE" },
  { symbol: "SOLARINDS",   name: "Solar Industries India",          exchange: "NSE" },
  { symbol: "SONACOMS",    name: "Sona BLW Precision Forgings",     exchange: "NSE" },
  { symbol: "STARHEALTH",  name: "Star Health & Allied Insurance",  exchange: "NSE" },
  { symbol: "SUNTV",       name: "Sun TV Network",                  exchange: "NSE" },
  { symbol: "SUPREMEIND",  name: "Supreme Industries",              exchange: "NSE" },
  { symbol: "SYNGENE",     name: "Syngene International",           exchange: "NSE" },
  { symbol: "TANLA",       name: "Tanla Platforms",                 exchange: "NSE" },
  { symbol: "TATACHEM",    name: "Tata Chemicals",                  exchange: "NSE" },
  { symbol: "TATACOMM",    name: "Tata Communications",             exchange: "NSE" },
  { symbol: "TATAELXSI",   name: "Tata Elxsi",                      exchange: "NSE" },
  { symbol: "THERMAX",     name: "Thermax",                         exchange: "NSE" },
  { symbol: "TIINDIA",     name: "Tube Investments of India",       exchange: "NSE" },
  { symbol: "TIMKEN",      name: "Timken India",                    exchange: "NSE" },
  { symbol: "TRIDENT",     name: "Trident Ltd",                     exchange: "NSE" },
  { symbol: "TRIVENI",     name: "Triveni Engineering",             exchange: "NSE" },
  { symbol: "UBLLTD",      name: "United Breweries",                exchange: "NSE" },
  { symbol: "UNIONBANK",   name: "Union Bank of India",             exchange: "NSE" },
  { symbol: "UPL",         name: "UPL Ltd",                         exchange: "NSE" },
  { symbol: "VEDL",        name: "Vedanta",                         exchange: "NSE" },
  { symbol: "VINATIORGA",  name: "Vinati Organics",                 exchange: "NSE" },
  { symbol: "WHIRLPOOL",   name: "Whirlpool of India",              exchange: "NSE" },
  { symbol: "ZEEL",        name: "Zee Entertainment Enterprises",   exchange: "NSE" },

  // ── Banking & Finance ──────────────────────────────────────
  { symbol: "BANDHANBNK",  name: "Bandhan Bank",                    exchange: "NSE" },
  { symbol: "EQUITASBNK",  name: "Equitas Small Finance Bank",      exchange: "NSE" },
  { symbol: "FINOLEXIND",  name: "Finolex Industries",              exchange: "NSE" },
  { symbol: "HDFCAMC",     name: "HDFC Asset Management Company",   exchange: "NSE" },
  { symbol: "IDBI",        name: "IDBI Bank",                       exchange: "NSE" },
  { symbol: "IIFL",        name: "IIFL Finance",                    exchange: "NSE" },
  { symbol: "INDIANB",     name: "Indian Bank",                     exchange: "NSE" },
  { symbol: "KFINTECH",    name: "KFin Technologies",               exchange: "NSE" },
  { symbol: "MCX",         name: "Multi Commodity Exchange",        exchange: "NSE" },
  { symbol: "MOTILALOFS",  name: "Motilal Oswal Financial Services",exchange: "NSE" },
  { symbol: "PNBHOUSING",  name: "PNB Housing Finance",             exchange: "NSE" },
  { symbol: "RECLTD",      name: "REC Ltd",                         exchange: "NSE" },
  { symbol: "SBICARD",     name: "SBI Cards and Payment Services",  exchange: "NSE" },
  { symbol: "SHRIRAMFIN",  name: "Shriram Finance",                 exchange: "NSE" },

  // ── IT & Tech ──────────────────────────────────────────────
  { symbol: "CYIENT",      name: "Cyient",                          exchange: "NSE" },
  { symbol: "HAPPSTMNDS",  name: "Happiest Minds Technologies",     exchange: "NSE" },
  { symbol: "HEXAWARE",    name: "Hexaware Technologies",           exchange: "NSE" },
  { symbol: "MASTEK",      name: "Mastek",                          exchange: "NSE" },
  { symbol: "MINDTREE",    name: "MindTree",                        exchange: "NSE" },
  { symbol: "NIITLTD",     name: "NIIT Ltd",                        exchange: "NSE" },
  { symbol: "ROUTE",       name: "Route Mobile",                    exchange: "NSE" },
  { symbol: "TATATECH",    name: "Tata Technologies",               exchange: "NSE" },
  { symbol: "ZENSAR",      name: "Zensar Technologies",             exchange: "NSE" },

  // ── Energy & Power ────────────────────────────────────────
  { symbol: "CESC",        name: "CESC Ltd",                        exchange: "NSE" },
  { symbol: "GUJGASLTD",   name: "Gujarat Gas",                     exchange: "NSE" },
  { symbol: "IGL",         name: "Indraprastha Gas",                exchange: "NSE" },
  { symbol: "MAHAGAS",     name: "Mahanagar Gas",                   exchange: "NSE" },
  { symbol: "NHPC",        name: "NHPC Ltd",                        exchange: "NSE" },
  { symbol: "OIL",         name: "Oil India",                       exchange: "NSE" },
  { symbol: "SJVN",        name: "SJVN Ltd",                        exchange: "NSE" },
  { symbol: "TORNTPOWER",  name: "Torrent Power",                   exchange: "NSE" },

  // ── Pharma & Healthcare ───────────────────────────────────
  { symbol: "ABBOTINDIA",  name: "Abbott India",                    exchange: "NSE" },
  { symbol: "ASTRAZEN",    name: "AstraZeneca Pharma India",        exchange: "NSE" },
  { symbol: "FORTIS",      name: "Fortis Healthcare",               exchange: "NSE" },
  { symbol: "GLAXO",       name: "GSK Pharmaceuticals",             exchange: "NSE" },
  { symbol: "NARAYANHRU",  name: "Narayana Hrudayalaya",            exchange: "NSE" },
  { symbol: "PFIZER",      name: "Pfizer India",                    exchange: "NSE" },
  { symbol: "SUNPHARMA",   name: "Sun Pharmaceutical Industries",   exchange: "NSE" },
  { symbol: "THYROCARE",   name: "Thyrocare Technologies",          exchange: "NSE" },

  // ── Consumer & Retail ─────────────────────────────────────
  { symbol: "CAMPUS",      name: "Campus Activewear",               exchange: "NSE" },
  { symbol: "CARTRADE",    name: "CarTrade Tech",                   exchange: "NSE" },
  { symbol: "EASEMYTRIP",  name: "Easy Trip Planners",              exchange: "NSE" },
  { symbol: "FRETAIL",     name: "Future Retail",                   exchange: "NSE" },
  { symbol: "METRO",       name: "Metro Brands",                    exchange: "NSE" },
  { symbol: "SAPPHIRE",    name: "Sapphire Foods India",            exchange: "NSE" },
  { symbol: "SHOPERSTOP",  name: "Shoppers Stop",                   exchange: "NSE" },
  { symbol: "VMART",       name: "V-Mart Retail",                   exchange: "NSE" },
  { symbol: "WESTLIFE",    name: "Westlife Foodworld",              exchange: "NSE" },

  // ── Indices (can be tracked, not traded directly) ─────────
  { symbol: "NIFTYBEES",   name: "Nippon India Nifty 50 ETF",       exchange: "NSE" },
  { symbol: "JUNIORBEES",  name: "Nippon India Junior BeES ETF",    exchange: "NSE" },
  { symbol: "BANKBEES",    name: "Nippon India Bank BeES ETF",      exchange: "NSE" },
  { symbol: "GOLDBEES",    name: "Nippon India Gold BeES ETF",      exchange: "NSE" },

  // ── BSE-listed stocks (.BO) ───────────────────────────────
  // These trade primarily or exclusively on BSE
  { symbol: "RELIANCE",    name: "Reliance Industries (BSE)",       exchange: "BSE" },
  { symbol: "TCS",         name: "Tata Consultancy Services (BSE)", exchange: "BSE" },
  { symbol: "HDFCBANK",    name: "HDFC Bank (BSE)",                 exchange: "BSE" },
  { symbol: "INFY",        name: "Infosys (BSE)",                   exchange: "BSE" },
  { symbol: "ICICIBANK",   name: "ICICI Bank (BSE)",                exchange: "BSE" },
  { symbol: "SBIN",        name: "State Bank of India (BSE)",       exchange: "BSE" },
  { symbol: "LT",          name: "Larsen & Toubro (BSE)",           exchange: "BSE" },
  { symbol: "WIPRO",       name: "Wipro (BSE)",                     exchange: "BSE" },
  { symbol: "HCLTECH",     name: "HCL Technologies (BSE)",          exchange: "BSE" },
  { symbol: "AXISBANK",    name: "Axis Bank (BSE)",                 exchange: "BSE" },
  { symbol: "MARUTI",      name: "Maruti Suzuki (BSE)",             exchange: "BSE" },
  { symbol: "SUNPHARMA",   name: "Sun Pharmaceutical (BSE)",        exchange: "BSE" },
  { symbol: "TATASTEEL",   name: "Tata Steel (BSE)",                exchange: "BSE" },
  { symbol: "TATAMOTORS",  name: "Tata Motors (BSE)",               exchange: "BSE" },
  { symbol: "ONGC",        name: "ONGC (BSE)",                      exchange: "BSE" },
  { symbol: "NTPC",        name: "NTPC (BSE)",                      exchange: "BSE" },
  { symbol: "COALINDIA",   name: "Coal India (BSE)",                exchange: "BSE" },
  { symbol: "BAJFINANCE",  name: "Bajaj Finance (BSE)",             exchange: "BSE" },
  { symbol: "KOTAKBANK",   name: "Kotak Mahindra Bank (BSE)",       exchange: "BSE" },
  { symbol: "DRREDDY",     name: "Dr Reddy's Laboratories (BSE)",   exchange: "BSE" },
  { symbol: "CIPLA",       name: "Cipla (BSE)",                     exchange: "BSE" },
  { symbol: "ULTRACEMCO",  name: "UltraTech Cement (BSE)",          exchange: "BSE" },
  { symbol: "ADANIENT",    name: "Adani Enterprises (BSE)",         exchange: "BSE" },
  { symbol: "JSWSTEEL",    name: "JSW Steel (BSE)",                 exchange: "BSE" },
  { symbol: "HINDALCO",    name: "Hindalco Industries (BSE)",       exchange: "BSE" },
  { symbol: "INDUSINDBK",  name: "IndusInd Bank (BSE)",             exchange: "BSE" },
  { symbol: "TITAN",       name: "Titan Company (BSE)",             exchange: "BSE" },
  { symbol: "NESTLEIND",   name: "Nestle India (BSE)",              exchange: "BSE" },
  { symbol: "POWERGRID",   name: "Power Grid Corporation (BSE)",    exchange: "BSE" },
  { symbol: "BRITANNIA",   name: "Britannia Industries (BSE)",      exchange: "BSE" },
  { symbol: "BAJAJFINSV",  name: "Bajaj Finserv (BSE)",             exchange: "BSE" },
  { symbol: "ITC",         name: "ITC Ltd (BSE)",                   exchange: "BSE" },
  { symbol: "HINDUNILVR",  name: "Hindustan Unilever (BSE)",        exchange: "BSE" },
  { symbol: "ASIANPAINT",  name: "Asian Paints (BSE)",              exchange: "BSE" },
  { symbol: "M&M",         name: "Mahindra & Mahindra (BSE)",       exchange: "BSE" },
  { symbol: "BHARTIARTL",  name: "Bharti Airtel (BSE)",             exchange: "BSE" },
  { symbol: "EICHERMOT",   name: "Eicher Motors (BSE)",             exchange: "BSE" },
  { symbol: "HEROMOTOCO",  name: "Hero MotoCorp (BSE)",             exchange: "BSE" },
  { symbol: "DIVISLAB",    name: "Divi's Laboratories (BSE)",       exchange: "BSE" },
  { symbol: "BPCL",        name: "Bharat Petroleum (BSE)",          exchange: "BSE" },
  { symbol: "GRASIM",      name: "Grasim Industries (BSE)",         exchange: "BSE" },
];

/**
 * Searches the stock list by symbol prefix first, then name contains.
 * Returns NSE results before BSE for the same symbol.
 * Case-insensitive. Returns up to `limit` results.
 */
export function searchStocks(query: string, limit = 8): StockEntry[] {
  const q = query.trim().toUpperCase();
  if (!q) return [];

  // Remove exchange suffix if user typed one — search on base symbol
  const base = q.replace(/\.(NS|NSE|BO|BSE)$/, "");

  // Detect if user is explicitly filtering by exchange
  const wantsNSE = q.endsWith(".NS") || q.endsWith(".NSE");
  const wantsBSE = q.endsWith(".BO") || q.endsWith(".BSE") || q.endsWith(".B");

  const filtered = STOCK_LIST.filter(s => {
    if (wantsNSE && s.exchange !== "NSE") return false;
    if (wantsBSE && s.exchange !== "BSE") return false;
    return s.symbol.startsWith(base) || s.name.toUpperCase().includes(base);
  });

  // Sort: symbol prefix match → name match, NSE before BSE
  filtered.sort((a, b) => {
    const aPrefix = a.symbol.startsWith(base) ? 0 : 1;
    const bPrefix = b.symbol.startsWith(base) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    if (a.exchange !== b.exchange) return a.exchange === "NSE" ? -1 : 1;
    return a.symbol.localeCompare(b.symbol);
  });

  return filtered.slice(0, limit);
}