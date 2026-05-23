# Trading Risk Manager

Web-based position sizing calculator for Indian equities (NSE/BSE).

## Stack

* Next.js App Router + TypeScript
* Tailwind CSS (dark theme)
* Yahoo Finance via server-side proxy
* Vercel deployment target

## Architecture

* `page.tsx` = server shell only
* `CalculatorClient.tsx` owns all app state
* Pure business logic in `lib/calculations.ts`
* API proxy at `/api/stock-price`

## Core Flow

1. User submits form
2. Validate inputs
3. Fetch live price from Yahoo Finance
4. Run position sizing calculations
5. Render results panel

## Core Formulas

* Risk/share = Entry − Stop Loss
* Max risk = Capital × Risk%
* Position size = floor(Max risk / Risk per share)
* Capital required = Shares × Entry

## Features

* NSE/BSE autocomplete
* Live LTP fetch
* Risk-based sizing
* Optional capital deployment limits
* Auto vs Limit sizing modes
* Mobile responsive layout

## Conventions

* No database/auth/state library
* Strict TypeScript types
* Lifted state pattern
* API calls only through server routes
* Whole shares only (no fractional sizing)

## Known Limitations

* Yahoo Finance is unofficial
* Static stock list
* No persistence/history
* No brokerage/tax calculations
* No portfolio-level risk view
