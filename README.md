# Trade Risk Manager

A professional-grade swing trading risk management and position sizing tool built for Indian equities (NSE/BSE) and US markets (NASDAQ/NYSE).

Designed with a prop-desk inspired workflow, Trade Risk Manager helps traders:

- Calculate safe position sizes with real-time price feeds
- Enforce strict capital and risk discipline
- Track all executed trades in a clean institutional-style ledger
- Monitor open trade exposure in real time
- Analyse portfolio performance with advanced statistics

---

## Features

### Position Size Calculator

Calculate optimal position size based on:

- Live LTP fetched automatically from Yahoo Finance (NSE/BSE and NASDAQ/NYSE)
- Stop loss and entry price
- Risk percentage of capital
- R:R ratio (configurable, default 2:1)
- Maximum capital allocation per position (admin-set limit)

The calculator automatically computes:

- Risk per share
- Quantity to buy
- Capital required
- Actual vs maximum risk exposure
- Implied target price at 2R

Trades where the capital required exceeds your available capital are blocked before execution — the button converts to a clear **Insufficient Capital** state rather than silently failing.

Signed-out users see a **Sign in to save trades** prompt instead of a disabled button.

Trades entered above the current LTP are automatically **queued** and activate when the price is reached.

---

### Trade Ledger

A clean institutional-style ledger for tracking all executed trades.

Track:

- Open, queued, closed, stopped, and target-hit trades
- Entry price, stop loss, and target
- Unrealised and realised PnL
- Live value (LTP × quantity) for open positions
- Risk exposure per trade

**Filter chips** at the top let you filter by status (Open, Closed, SL Hit, TG Hit) — the summary row at the bottom recalculates for whatever is in view.

Expandable trade rows provide:

- Detailed trade metrics
- Target tracking
- Days held
- Trade management actions (close, mark stopped, mark target hit)

---

### Portfolio Dashboard

#### Floating Stats Bar
A sticky top bar showing at a glance:

- Portfolio Value (LTP × qty across all open positions)
- Mark to Market P&L (unrealised)
- Portfolio Risk % (total risk / capital)
- Win Rate
- Remaining Capital
- Drawdown (open positions below entry)

#### Summary Cards
- **Total P&L** — realised + unrealised
- **Win Rate** — W / L / Breakeven across all closed trades
- **W:L Ratio** — average win size vs average loss size
- **Sharpe Ratio** — mean per-trade return / standard deviation
- **Sortino Ratio** — mean per-trade return / downside deviation only

#### Portfolio Equity Curve
- Realised P&L curve built from daily snapshots (via Supabase Edge Function + Yahoo Finance historical data)
- MTM curve showing daily mark-to-market fluctuation — not a flat offset
- Clickable monthly P&L chips to zoom into any month
- Backfilled from first trade date on initial setup

#### Open Risk Card (merged view)
Three panels in one card:

**Trade Health** — open positions categorised as Winning or Losing with ticker chips

**Risk Allocation Donut** — pie chart showing each position's risk % of total pool, with capital deployed per position in the legend

**Risk Table** — sortable table showing:
- Risk ₹ and % of pool
- SL/TG progress bar (grey track, entry tick, green toward target, red toward stop)
- Return % on each position
- Days held

---


### Organisation Features

Full multi-user org hierarchy with owner, admin, and member roles. Admins can invite members via generated links, set per-member capital limits, manage groups, and view a leaderboard of member performance. Members can opt in or out of the leaderboard.

---
## Previews

### Position Size Calculator
<img width="1682" height="1161" alt="Screenshot 2026-07-21 at 9 57 37 AM" src="https://github.com/user-attachments/assets/9e23dde6-6f14-4efd-bf05-4d6b1ba17318" />

### Portfolio Dashboard
<img width="1682" height="1161" alt="Screenshot 2026-07-21 at 9 47 38 AM" src="https://github.com/user-attachments/assets/a24732bb-d800-40f5-8f22-54a17b70f548" />

### Trade Ledger
<img width="1682" height="1161" alt="Screenshot 2026-07-21 at 9 47 53 AM" src="https://github.com/user-attachments/assets/433028a8-eb43-444a-a9f6-a1f76a25e698" />

---
## Risk Logic

**Trade Risk**

```
Risk = |Entry − Stop| × Quantity
```

**Risk Percentage**

```
Risk % = Trade Risk / Portfolio Capital × 100
```

**Target Price (2R)**

```
Target = Entry + 2 × (Entry − Stop)
```

**SL/TG Bar Progress**

```
Progress = (LTP − Stop) / (Target − Stop)
```

Clamped between stop and target; green when above entry, red when below.

---

## Tech Stack

- **Next.js 16** (App Router, Turbopack)
- **React** with TypeScript
- **Tailwind CSS**
- **Supabase** (Postgres, Auth, RLS, Edge Functions)
- **Recharts** for equity curve and risk pie chart
- **Yahoo Finance** via yfinance for live and historical prices
- **Vercel** for deployment

---

## Architecture Notes

- Daily portfolio snapshots written by a scheduled Supabase Edge Function at 15:30 IST (market close) — enables a real historical equity curve
- A one-time backfill function reconstructs all historical snapshots from your first trade date using Yahoo Finance OHLC data
- Capital limit enforcement runs both at the frontend (blocks the save button) and is stored per-user in the database (admin-configurable)
- All risk calculations are deterministic and run client-side — no server round-trip needed for the calculator

---

## Built For

- Swing Traders
- Small Prop Teams
- Risk-Conscious Traders
- Indian Equity Markets (NSE/BSE)
- US Equity Markets (NASDAQ/NYSE)

---

## Design Philosophy

This project intentionally avoids retail trading clutter.
The interface is optimised for:

- Low cognitive load
- Fast scanning
- Rapid risk assessment

Dark and light modes are fully supported across every component.

---

## Disclaimer

This software is intended for educational and risk management purposes only.
Trading in financial markets involves substantial risk. Use at your own discretion.
