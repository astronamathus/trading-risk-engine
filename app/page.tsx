// ============================================================
// app/page.tsx — Calculator page (server component shell)
// ============================================================

import CalculatorClient from "@/components/CalculatorClient";

export default function HomePage() {
  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl flex flex-col gap-8">

        <header className="flex flex-col items-center text-center gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Trade Risk Manager
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Position sizing calculator for Indian equities (NSE / BSE).
            Enter your trade details to calculate a safe position size.
          </p>
        </header>

        <CalculatorClient />

        <footer className="text-center text-xs text-slate-400 dark:text-slate-600">
          Prices via yfinance · Educational use only
        </footer>

      </div>
    </main>
  );
}