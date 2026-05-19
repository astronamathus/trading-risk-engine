import React from 'react';
import { CalculationResult } from '@/lib/types';

interface ResultsDisplayProps {
  result: CalculationResult;
}

export default function ResultsDisplay({ result }: ResultsDisplayProps) {
  const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);

  const formatNumber = (value: number): string =>
    new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{result.input.ticker}</p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">{formatCurrency(result.stockPrice)}</p>
        <p className="mt-1 text-xs text-slate-400">Current market price</p>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-700 p-4">
        <Metric label="Risk per Share" value={formatCurrency(result.output.riskPerShare)} />
        <Metric label="Max Risk Amount" value={formatCurrency(result.output.maxRiskAmount)} />
        <Metric label="Position Size" value={`${formatNumber(result.output.positionSize)} shares`} emphasize />
        <Metric label="Capital Required" value={formatCurrency(result.output.capitalRequired)} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 py-2 last:border-b-0">
      <span className="text-sm text-slate-300">{label}</span>
      <span className={emphasize ? 'text-lg font-semibold text-slate-100' : 'text-sm font-medium text-slate-200'}>{value}</span>
    </div>
  );
}
