

# Trade Risk Manager

> A professional-grade swing trading risk management and position sizing tool built for Indian equities (NSE/BSE).

Designed with a prop-desk inspired workflow, **Trade Risk Manager** helps traders:

* Calculate safe position sizes
* Enforce strict risk discipline
* Track all executed trades in a clean ledger
* Monitor open trade exposure in real time

---

## Features

### Position Size Calculator

Calculate optimal position size based on:

* Total capital
* Stop loss
* Risk percentage
* Maximum capital allocation

The calculator automatically computes:

* Risk per share
* Quantity to buy
* Capital required
* Actual risk exposure

---

### Trade Ledger

A clean institutional-style ledger for tracking executed trades.

Track:

* Open positions
* Stop losses
* Targets
* Unrealized PnL
* Risk exposure
* Trade progress

Expandable trade rows provide:

* Detailed trade metrics
* Target tracking
* Risk-to-reward (R:R) visualization
* Days held
* Trade management actions

---

### Risk-First Architecture

The platform prioritizes:

* Downside protection
* Portfolio heat awareness
* Controlled position sizing
* Disciplined execution

Every trade is evaluated against predefined risk constraints before execution.

---

## Built For

* Swing Traders
* Small Prop Teams
* Risk-Conscious Traders
* Indian Equity Markets (NSE/BSE)

---

# Previews

## Position Size Calculator

<img width="1357" height="826" alt="Screen Shot 2026-05-28 at 1 15 10 PM" src="https://github.com/user-attachments/assets/550c219e-0855-4454-8ca2-a477e739e5b3" />

---

## Trade Ledger

<img width="1357" height="826" alt="Screen Shot 2026-05-28 at 1 15 26 PM" src="https://github.com/user-attachments/assets/6f2ca18c-c8ed-4e11-bf3b-2da8de05d6dc" />

---

# Core Risk Logic

## Position Risk

```math
Trade\ Risk = |Entry - Stop| \times Qty
```

---

## Risk Percentage

```math
Risk\ \% = \frac{Trade\ Risk}{Portfolio\ Capital} \times 100
```

---

## Target Price (2R)

For long positions:

```math
Target = Entry + 2(Entry - Stop)
```

---

## Trade Progress

Normalized progress between stop loss and target:

```math
Trade\ Progress = \frac{LTP - Entry}{Target - Entry}
```

---

# Tech Stack

* Next.js
* React
* Tailwind CSS
* TypeScript
* Vercel

---

# Current MVP Scope

## Included

* Position sizing calculator
* Trade ledger
* Risk calculations
* Target generation
* Trade expansion view
* PnL tracking
* Trade progress visualization

---

## Planned

* Portfolio analytics
* Portfolio heat tracking
* Team-level risk monitoring
* Sector exposure analysis
* Broker integrations
* Advanced performance analytics

---

# Design Philosophy

This project intentionally avoids retail trading clutter.

The interface is optimized for:

* Low cognitive load
* Fast scanning
* Rapid risk assessment
  
---

# Future Roadmap

* Portfolio dashboard
* Advanced trade analytics
* Multi-user desk support
* Mobile companion view
* Risk violation engine

---

# Disclaimer

This software is intended for educational and risk management purposes only.

Trading in financial markets involves substantial risk.
Use at your own discretion.
