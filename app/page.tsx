// ============================================================
// app/page.tsx
// Server Component — no "use client" here.
//
// This file handles layout and static content only.
// All interactivity is delegated to CalculatorClient.
// This is the correct Next.js App Router pattern.
// ============================================================

import CalculatorClient from "@/components/CalculatorClient";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl flex flex-col gap-8">

        {/* Static header */}
        <header className="flex flex-col items-center text-center gap-2 pt-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Trade Risk Manager
          </h1>
          <p className="text-sm text-slate-400 max-w-sm">
            Position sizing calculator for Indian equities (NSE / BSE).
            Enter your trade details to calculate a safe position size.
          </p>
        </header>

        {/* All interactive logic lives inside here */}
        <CalculatorClient />

        <footer className="text-center text-xs text-slate-600">
          Prices fetched from Yahoo Finance · For educational purposes only
        </footer>

      </div>
    </main>
  );
}