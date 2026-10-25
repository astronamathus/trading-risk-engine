-- Per-market currency pools. Existing trades remain INR to preserve historical Indian-market behavior.
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'INR';

ALTER TABLE public.trades
  ADD CONSTRAINT trades_currency_check CHECK (currency IN ('INR', 'USD'));

ALTER TABLE public.trader_users
  ADD COLUMN IF NOT EXISTS capital_limit_usd numeric NOT NULL DEFAULT 10000;

COMMENT ON COLUMN public.trades.currency IS 'Currency denomination for all prices, capital, risk, and P&L on this trade.';
COMMENT ON COLUMN public.trader_users.capital_limit_usd IS 'Separate USD capital pool; capital_limit remains the INR pool.';
