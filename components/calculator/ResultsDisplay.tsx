// ResultsDisplay component
// Shows the calculated position sizing results

import React from 'react';
import { CalculationResult } from '@/lib/types';

interface ResultsDisplayProps {
  result: CalculationResult;
}

export default function ResultsDisplay({ result }: ResultsDisplayProps) {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">Stock Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Ticker</p>
            <p className="text-xl font-bold">{result.input.ticker}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Current Price</p>
            <p className="text-xl font-bold">{formatCurrency(result.stockPrice)}</p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-green-900 mb-2">Position Sizing Results</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Risk per Share:</span>
            <span className="font-semibold">{formatCurrency(result.output.riskPerShare)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Max Risk Amount:</span>
            <span className="font-semibold">{formatCurrency(result.output.maxRiskAmount)}</span>
          </div>
          <div className="flex justify-between items-center border-t pt-3">
            <span className="text-gray-700">Position Size (Shares):</span>
            <span className="font-bold text-2xl text-green-700">{formatNumber(result.output.positionSize)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Capital Required:</span>
            <span className="font-semibold">{formatCurrency(result.output.capitalRequired)}</span>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">Risk Summary</h3>
        <p className="text-sm text-gray-700">
          Based on your capital of <strong>{formatCurrency(result.input.capital)}</strong> and risk tolerance of{' '}
          <strong>{result.input.riskPercentage}%</strong>, you should buy{' '}
          <strong>{formatNumber(result.output.positionSize)} shares</strong> of {result.input.ticker}.
          This limits your maximum loss to <strong>{formatCurrency(result.output.maxRiskAmount)}</strong>.
        </p>
      </div>
    </div>
  );
}
