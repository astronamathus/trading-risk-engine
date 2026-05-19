import React, { useMemo, useState } from 'react';
import { PositionInput } from '@/lib/types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface PositionFormProps {
  onSubmit: (input: PositionInput) => Promise<void>;
  loading?: boolean;
}

const TICKER_SUGGESTIONS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC', 'TATAMOTORS', 'BHARTIARTL', 'LT', 'ASIANPAINT', 'AXISBANK'];

export default function PositionForm({ onSubmit, loading = false }: PositionFormProps) {
  const [ticker, setTicker] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [capital, setCapital] = useState('10000');
  const [riskPercentage, setRiskPercentage] = useState('2');
  const [tickerFocused, setTickerFocused] = useState(false);
  const [tickerLoading, setTickerLoading] = useState(false);
  const [lastTradedPrice, setLastTradedPrice] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredSuggestions = useMemo(() => {
    const query = ticker.trim().toUpperCase();
    if (!query) return TICKER_SUGGESTIONS.slice(0, 8);
    return TICKER_SUGGESTIONS.filter((item) => item.includes(query)).slice(0, 8);
  }, [ticker]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const stopLossNumber = parseFloat(stopLoss);

    if (!ticker.trim()) newErrors.ticker = 'Ticker is required';
    if (!stopLoss || stopLossNumber <= 0) newErrors.stopLoss = 'Stop loss must be greater than 0';
    if (!capital || parseFloat(capital) <= 0) newErrors.capital = 'Capital must be greater than 0';
    if (!riskPercentage || parseFloat(riskPercentage) <= 0 || parseFloat(riskPercentage) > 100) {
      newErrors.riskPercentage = 'Risk percentage must be between 0 and 100';
    }
    if (lastTradedPrice && stopLossNumber >= lastTradedPrice) {
      newErrors.stopLoss = 'Stop loss should be below current price to calculate position size';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchAndSetLtp = async (rawTicker: string) => {
    const nextTicker = rawTicker.toUpperCase().trim();
    if (!nextTicker) return;

    setTickerLoading(true);
    try {
      const response = await fetch(`/api/stock-price?ticker=${encodeURIComponent(nextTicker)}`);
      const data = await response.json();
      if (response.ok && typeof data.price === 'number') {
        const ltp = Number(data.price);
        setLastTradedPrice(ltp);
        setStopLoss((ltp * 0.98).toFixed(2));
      }
    } finally {
      setTickerLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    await onSubmit({
      ticker: ticker.toUpperCase().trim(),
      stopLoss: parseFloat(stopLoss),
      capital: parseFloat(capital),
      riskPercentage: parseFloat(riskPercentage),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="relative flex flex-col gap-1.5">
        <label htmlFor="ticker" className="text-sm font-medium text-slate-200">Stock Ticker <span className="ml-1 text-rose-400">*</span></label>
        <input
          id="ticker"
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onFocus={() => setTickerFocused(true)}
          onBlur={() => {
            setTimeout(() => setTickerFocused(false), 120);
            fetchAndSetLtp(ticker);
          }}
          placeholder="e.g., RELIANCE, TCS"
          className={`rounded-xl border bg-slate-950 px-3 py-2.5 text-slate-50 shadow-sm outline-none transition placeholder:text-slate-500 focus:ring-2 focus:ring-sky-500/40 ${errors.ticker ? 'border-rose-400' : 'border-slate-700'}`}
          required
          autoComplete="off"
        />

        {tickerFocused && filteredSuggestions.length > 0 && (
          <div className="absolute top-full z-20 mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 shadow-xl">
            {filteredSuggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setTicker(item);
                  fetchAndSetLtp(item);
                  setTickerFocused(false);
                }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        <div className="text-xs text-slate-400">
          {tickerLoading
            ? 'Fetching live price…'
            : lastTradedPrice
              ? `LTP: ₹${lastTradedPrice.toFixed(2)} · Stop loss auto-set to 2% below LTP`
              : 'Type any ticker in lowercase or uppercase — it will display in UPPERCASE.'}
        </div>
        {errors.ticker && <p className="text-xs text-rose-400">{errors.ticker}</p>}
      </div>

      <Input label="Stop Loss Price (₹)" type="number" step="0.01" value={stopLoss} onChange={setStopLoss} placeholder="Auto-populated from live price" error={errors.stopLoss} required />
      <Input label="Total Capital (₹)" type="number" step="0.01" value={capital} onChange={setCapital} placeholder="e.g., 10000" error={errors.capital} required />
      <Input label="Risk Percentage (%)" type="number" step="0.1" value={riskPercentage} onChange={setRiskPercentage} placeholder="e.g., 2" error={errors.riskPercentage} required />

      <Button type="submit" loading={loading || tickerLoading} className="w-full">Calculate Position Size</Button>
    </form>
  );
}
