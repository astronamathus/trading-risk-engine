"use client";

import { Trade } from "@/lib/db/trades";

interface RiskTableProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

function RiskBar({ pct, warn }: { pct: number; warn: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${warn ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={`text-xs tabular-nums w-10 text-right ${warn ? "text-red-400" : "text-slate-400"}`}>
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}

export default function RiskTable({ trades, livePrices }: RiskTableProps) {
  const open = trades.filter(t => t.status === "OPEN");

  const totalCapitalDeployed = open.reduce(
    (s, t) => s + t.entry_price * t.quantity, 0
  );

  const totalRisk = open.reduce((s, t) => s + (t.risk_amount ?? 0), 0);

  // Per-stock risk rows
  const rows = open.map(t => {
    const ltp         = livePrices[t.ticker];
    const posValue    = (ltp ?? t.entry_price) * t.quantity;
    const riskAmt     = t.risk_amount ?? 0;
    const capital     = t.capital ?? 100000;
    const riskPct     = capital > 0 ? (riskAmt / capital) * 100 : 0;
    const portfolioPct = totalCapitalDeployed > 0 ? (posValue / totalCapitalDeployed) * 100 : 0;
    const distToSL    = ltp !== undefined ? ((ltp - t.stop_loss) / ltp) * 100 : null;
    const warn        = riskPct > 1.5;
    return {
      ticker: t.ticker.replace(/\.(NS|BO)$/, ""),
      posValue, riskAmt, riskPct, portfolioPct, distToSL, warn,
      stopLoss: t.stop_loss,
      ltp,
    };
  }).sort((a, b) => b.riskPct - a.riskPct);

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Risk Breakdown</h3>
        <div className="text-xs text-slate-500">
          Total at risk: <span className="text-amber-400 font-medium">{formatINR(totalRisk)}</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-sm text-slate-600 text-center py-8">
          No open positions to analyse.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2 w-1/4">Stock</th>
                <th className="text-right pb-2 w-1/5">Position</th>
                <th className="text-right pb-2 w-1/5">Risk ₹</th>
                <th className="text-right pb-2 w-1/6">Dist. to SL</th>
                <th className="text-left pb-2">Risk % of Capital</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(r => (
                <tr key={r.ticker} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-2.5 pr-4">
                    <span className="font-mono font-semibold text-slate-200">{r.ticker}</span>
                    <div className="text-xs text-slate-600 mt-0.5">
                      SL {formatINR(r.stopLoss)}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-slate-300">
                    {formatINR(r.posValue)}
                  </td>
                  <td className={`py-2.5 pr-4 text-right tabular-nums font-medium ${
                    r.warn ? "text-red-400" : "text-slate-300"
                  }`}>
                    {formatINR(r.riskAmt)}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {r.distToSL !== null ? (
                      <span className={r.distToSL < 2 ? "text-red-400" : "text-slate-400"}>
                        {r.distToSL.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="py-2.5 w-40">
                    <RiskBar pct={r.riskPct} warn={r.warn}/>
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Footer */}
            <tfoot className="border-t border-slate-700">
              <tr className="text-xs text-slate-500">
                <td className="pt-3 font-medium text-slate-400">
                  {rows.length} positions
                </td>
                <td className="pt-3 text-right tabular-nums text-slate-400">
                  {formatINR(totalCapitalDeployed)}
                </td>
                <td className="pt-3 text-right tabular-nums text-amber-400 font-medium">
                  {formatINR(totalRisk)}
                </td>
                <td className="pt-3"/>
                <td className="pt-3"/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}