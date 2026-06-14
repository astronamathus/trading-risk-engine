"use client";

import { useState, useMemo } from "react";
import { Trade } from "@/lib/db/trades";

interface RiskTableProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

type SortKey = "time" | "risk_amount" | "risk_pct" | "current_r" | "days_held";
type SortDir = "asc" | "desc";

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg className={`w-3 h-3 inline-block ml-1 transition-opacity ${active ? "opacity-100" : "opacity-20"}`}
      viewBox="0 0 12 12" fill="currentColor">
      {dir === "asc" || !active
        ? <path d="M6 2l3.5 5H2.5L6 2z"/>
        : <path d="M6 10L2.5 5h7L6 10z"/>
      }
    </svg>
  );
}

export default function RiskTable({ trades, livePrices }: RiskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("risk_amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const open      = trades.filter(t => t.status === "OPEN");
  const totalRisk = open.reduce((s, t) => s + (t.risk_amount ?? 0), 0);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const rows = useMemo(() => {
    return open.map(t => {
      const ltp       = livePrices[t.ticker];
      const riskAmt   = t.risk_amount ?? 0;
      const capital   = t.capital ?? 100000;
      const riskPct   = totalRisk > 0 ? (riskAmt / totalRisk) * 100 : 0;
      const currentR  = ltp !== undefined && riskAmt > 0
        ? ((ltp - t.entry_price) * t.quantity) / riskAmt
        : null;
      const daysHeld  = Math.floor(
        (Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { trade: t, riskAmt, riskPct, currentR, daysHeld, capital };
    });
  }, [open, livePrices, totalRisk]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let diff = 0;
      switch (sortKey) {
        case "time":        diff = new Date(a.trade.created_at).getTime() - new Date(b.trade.created_at).getTime(); break;
        case "risk_amount": diff = a.riskAmt - b.riskAmt; break;
        case "risk_pct":    diff = a.riskPct - b.riskPct; break;
        case "current_r":   diff = (a.currentR ?? -999) - (b.currentR ?? -999); break;
        case "days_held":   diff = a.daysHeld - b.daysHeld; break;
      }
      return sortDir === "desc" ? -diff : diff;
    });
  }, [rows, sortKey, sortDir]);

  function ColHeader({
    label, sortable, k,
  }: { label: string; sortable?: SortKey; k?: string }) {
    if (!sortable) return (
      <th className="text-left pb-2 pr-4 text-xs uppercase tracking-wider text-slate-500">
        {label}
      </th>
    );
    return (
      <th
        className="pb-2 pr-4 text-xs uppercase tracking-wider text-slate-500
          cursor-pointer select-none hover:text-slate-300 transition-colors text-left"
        onClick={() => toggleSort(sortable)}
      >
        {label}
        <SortIcon active={sortKey === sortable} dir={sortDir}/>
      </th>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Risk Breakdown</h3>
        <span className="text-xs text-slate-500">
          Total at risk: <span className="text-amber-400 font-medium">{formatINR(totalRisk)}</span>
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="text-sm text-slate-600 text-center py-8">No open positions.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <ColHeader label="Stock" sortable="time"/>
                <ColHeader label="Risk ₹" sortable="risk_amount"/>
                <ColHeader label="Risk % Portfolio" sortable="risk_pct"/>
                <ColHeader label="Current R" sortable="current_r"/>
                <ColHeader label="Days Held" sortable="days_held"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sorted.map(({ trade, riskAmt, riskPct, currentR, daysHeld }) => {
                const rPositive = currentR !== null && currentR >= 0;
                const rColour   = currentR === null ? "text-slate-600"
                  : rPositive ? "text-emerald-400" : "text-red-400";

                return (
                  <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 pr-4">
                      <span className="font-mono font-semibold text-slate-200">
                        {trade.ticker.replace(/\.(NS|BO)$/, "")}
                      </span>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {new Date(trade.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short",
                        })}
                      </div>
                    </td>

                    <td className="py-3 pr-4 tabular-nums">
                      <span className="text-slate-300">{formatINR(riskAmt)}</span>
                      {/* Mini risk bar */}
                      <div className="mt-1 h-1 rounded-full bg-slate-700 w-20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500/70"
                          style={{ width: `${Math.min(riskPct, 100)}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3 pr-4 tabular-nums text-slate-400">
                      {riskPct.toFixed(1)}%
                    </td>

                    <td className={`py-3 pr-4 tabular-nums font-medium ${rColour}`}>
                      {currentR !== null
                        ? `${rPositive ? "+" : ""}${currentR.toFixed(2)}R`
                        : "—"}
                    </td>

                    <td className="py-3 tabular-nums text-slate-400">
                      {daysHeld === 0 ? "Today" : `${daysHeld}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="border-t border-slate-700">
              <tr className="text-xs text-slate-500">
                <td className="pt-3 text-slate-400 font-medium">{sorted.length} positions</td>
                <td className="pt-3 tabular-nums text-amber-400 font-medium">{formatINR(totalRisk)}</td>
                <td className="pt-3">100%</td>
                <td className="pt-3 tabular-nums">
                  {rows.filter(r => r.currentR !== null).length > 0 ? (
                    <span className={
                      rows.reduce((s, r) => s + (r.currentR ?? 0), 0) >= 0
                        ? "text-emerald-400" : "text-red-400"
                    }>
                      {(() => {
                        const validR = rows.filter(r => r.currentR !== null);
                        const avg = validR.reduce((s, r) => s + (r.currentR ?? 0), 0) / validR.length;
                        return `${avg >= 0 ? "+" : ""}${avg.toFixed(2)}R avg`;
                      })()}
                    </span>
                  ) : "—"}
                </td>
                <td className="pt-3"/>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}