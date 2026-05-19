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
      // Fetch stock price from our API
      const response = await fetch(`/api/stock-price?ticker=${input.ticker}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch stock price');
      }

      const stockData = await response.json();
      const stockPrice = stockData.price;

      // Calculate position size
      const output = calculatePositionSize(input, stockPrice);

      setResult({
        input,
        stockPrice,
        output,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Trading Risk Calculator
          </h1>
          <p className="text-lg text-gray-600">
            Calculate optimal position sizes for Indian stocks based on your risk tolerance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card title="Enter Position Details">
            <PositionForm onSubmit={handleCalculate} loading={loading} />
          </Card>

          <div>
            {error && (
              <Card className="mb-4 border-red-200 bg-red-50">
                <p className="text-red-700">{error}</p>
              </Card>
            )}

            {result && (
              <Card title="Calculation Results">
                <ResultsDisplay result={result} />
              </Card>
            )}

            {!result && !error && (
              <Card className="flex items-center justify-center h-64">
                <p className="text-gray-500 text-center">
                  Enter your position details and click calculate to see results
                </p>
              </Card>
            )}
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Built with Next.js, TypeScript, and Tailwind CSS</p>
          <p className="mt-2">For educational purposes only. Not financial advice.</p>
        </div>
      </div>
    </div>
  );
}
