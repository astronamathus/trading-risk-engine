// PositionForm component
// Handles user input for position sizing calculation

import React, { useState } from 'react';
import { PositionInput } from '@/lib/types';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

interface PositionFormProps {
  onSubmit: (input: PositionInput) => void;
  loading?: boolean;
}

export default function PositionForm({ onSubmit, loading = false }: PositionFormProps) {
  const [ticker, setTicker] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [capital, setCapital] = useState('');
  const [riskPercentage, setRiskPercentage] = useState('2');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!ticker.trim()) {
      newErrors.ticker = 'Ticker is required';
    }

    if (!stopLoss || parseFloat(stopLoss) <= 0) {
      newErrors.stopLoss = 'Stop loss must be greater than 0';
    }

    if (!capital || parseFloat(capital) <= 0) {
      newErrors.capital = 'Capital must be greater than 0';
    }

    if (!riskPercentage || parseFloat(riskPercentage) <= 0 || parseFloat(riskPercentage) > 100) {
      newErrors.riskPercentage = 'Risk percentage must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const input: PositionInput = {
      ticker: ticker.toUpperCase(),
      stopLoss: parseFloat(stopLoss),
      capital: parseFloat(capital),
      riskPercentage: parseFloat(riskPercentage),
    };

    onSubmit(input);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Stock Ticker"
        type="text"
        value={ticker}
        onChange={setTicker}
        placeholder="e.g., RELIANCE, TCS"
        error={errors.ticker}
        required
      />

      <Input
        label="Stop Loss Price (₹)"
        type="number"
        step="0.01"
        value={stopLoss}
        onChange={setStopLoss}
        placeholder="e.g., 2400"
        error={errors.stopLoss}
        required
      />

      <Input
        label="Total Capital (₹)"
        type="number"
        step="0.01"
        value={capital}
        onChange={setCapital}
        placeholder="e.g., 100000"
        error={errors.capital}
        required
      />

      <Input
        label="Risk Percentage (%)"
        type="number"
        step="0.1"
        value={riskPercentage}
        onChange={setRiskPercentage}
        placeholder="e.g., 2"
        error={errors.riskPercentage}
        required
      />

      <Button type="submit" loading={loading} className="w-full">
        Calculate Position Size
      </Button>
    </form>
  );
}
