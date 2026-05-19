'use client';

import React, { useState } from 'react';
import PositionForm from '@/components/calculator/PositionForm';
import ResultsDisplay from '@/components/calculator/ResultsDisplay';
import Card from '@/components/ui/Card';
import { PositionInput, CalculationResult } from '@/lib/types';
import { calculatePositionSize } from '@/lib/calculations';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async (input: PositionInput) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/stock-price?ticker=${input.ticker}`);
      const stockData = await response.json();

      if (!response.ok) {
        throw new Error(stockData.error ?? 'Failed to fetch stock price');
      }

      const output = calculatePositionSize(input, stockData.price);
      setResult({ input, stockPrice: stockData.price, output });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="mb-10 text-center">
          <p className="mb-3 inline-flex rounded-full border border-blue-100 bg-white/70 px-3 py-1 text-xs font-semibold tracking-wide text-blue-700">
            Risk-first position sizing
          </p>
          <h1 className="mb-3 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Trading Risk Calculator
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600 sm:text-lg">
            Beautifully simple workflow for position sizing. Enter your setup, fetch live-like pricing, and get clean risk metrics instantly.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card title="Position Inputs">
            <PositionForm onSubmit={handleCalculate} loading={loading} />
          </Card>

          <div>
            {error && (
              <Card className="mb-4 border border-rose-200 bg-rose-50/90">
                <p className="text-sm font-medium text-rose-700">{error}</p>
              </Card>
            )}

            {result ? (
              <Card title="Results">
                <ResultsDisplay result={result} />
              </Card>
            ) : (
              !error && (
                <Card className="flex h-full min-h-72 items-center justify-center text-center">
                  <p className="max-w-sm text-sm text-slate-500">
                    Your outputs will appear here after calculation, including risk per share, max drawdown risk, and capital required.
                  </p>
                </Card>
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
