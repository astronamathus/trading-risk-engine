import React, { useState } from 'react';
import { PositionInput } from '@/lib/types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface PositionFormProps {
  onSubmit: (input: PositionInput) => Promise<void>;
  loading?: boolean;
}

const TICKER_SUGGESTIONS = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'ITC', 'TATAMOTORS'];

export default function PositionForm({ onSubmit, loading = false }: PositionFormProps) {
  const [ticker, setTicker] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [capital, setCapital] = useState('10000');
  const [riskPercentage, setRiskPercentage] = useState('2');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!ticker.trim()) newErrors.ticker = 'Ticker is required';
    if (!stopLoss || parseFloat(stopLoss) <= 0) newErrors.stopLoss = 'Stop loss must be greater than 0';
    if (!capital || parseFloat(capital) <= 0) newErrors.capital = 'Capital must be greater than 0';
    if (!riskPercentage || parseFloat(riskPercentage) <= 0 || parseFloat(riskPercentage) > 100) {
      newErrors.riskPercentage = 'Risk percentage must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!validateForm()) return;

    const input: PositionInput = {
      ticker: ticker.toUpperCase().trim(),
      stopLoss: parseFloat(stopLoss),
      capital: parseFloat(capital),
      riskPercentage: parseFloat(riskPercentage),
    };

    await onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ticker" className="text-sm font-medium text-slate-200">Stock Ticker <span className="ml-1 text-rose-400">*</span></label>
        <input
          id="ticker"
          list="ticker-suggestions"
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="e.g., RELIANCE, TCS"
          className={`rounded-xl border bg-slate-900 px-3 py-2.5 text-slate-50 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-2 focus:ring-slate-500 ${
            errors.ticker ? 'border-rose-400' : 'border-slate-700'
          }`}
          required
          autoComplete="off"
        />
        <datalist id="ticker-suggestions">
          {TICKER_SUGGESTIONS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        {errors.ticker && <p className="text-xs text-rose-400">{errors.ticker}</p>}
      </div>

      <Input label="Stop Loss Price (₹)" type="number" step="0.01" value={stopLoss} onChange={setStopLoss} placeholder="e.g., 2400" error={errors.stopLoss} required />
      <Input label="Total Capital (₹)" type="number" step="0.01" value={capital} onChange={setCapital} placeholder="e.g., 10000" error={errors.capital} required />
      <Input label="Risk Percentage (%)" type="number" step="0.1" value={riskPercentage} onChange={setRiskPercentage} placeholder="e.g., 2" error={errors.riskPercentage} required />

      <Button type="submit" loading={loading} className="w-full">Calculate Position Size</Button>
    </form>
  );
}
