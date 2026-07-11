"use client";

import { useState, useMemo } from "react";
import { Trade } from "@/lib/db/trades";

interface RiskTableProps {
  trades:     Trade[];
  livePrices: Record<string, number>;
}

type OpenSort   = "time" | "risk_amount" | "risk_pct" | "current_r" | "days_held";
type ClosedSort = "time" | "pnl" | "r" | "ticker";
type SortDir    = "asc" | "desc";

const CLOSED_STATUSES = ["CLOSED", "STOPPED", "TARGET_HIT"] as const;

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

const STATUS_STYLE: Record<string, string> = {
  TARGET_HIT: "border-blue-700 text-blue-400 bg-blue-900/20",
  CLOSED:     "border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 dark:text-slate-400 bg-slate-100/40 dark:bg-white dark:bg-slate-800/40",
  STOPPED:    "border-red-800 text-red-400 bg-red-900/20",
};
const STATUS_LABEL: Record<string, string> = {
  TARGET_HIT: "TG HIT", CLOSED: "CLOSED", STOPPED: "SL HIT",
};

export default function RiskTable({ trades, livePrices }: RiskTableProps) {
  const [tab,          setTab]          = useState<"open" | "closed">("open");
  const [openSort,     setOpenSort]     = useState<OpenSort>("risk_amount");
  const [closedSort,   setClosedSort]   = useState<ClosedSort>("time");
  const [sortDir,      setSortDir]      = useState<SortDir>("desc");

  const open   = trades.filter(t => t.status === "OPEN");
  const closed = trades.filter(t => (CLOSED_STATUSES as readonly string[]).includes(t.status));
  const totalRisk     = open.reduce((s, t) => s + (t.risk_amount ?? 0), 0);
  const totalRealisedPnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);

  function toggleOpenSort(key: OpenSort) {
    if (openSort === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setOpenSort(key); setSortDir("desc"); }
  }

  function toggleClosedSort(key: ClosedSort) {
    if (closedSort === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setClosedSort(key); setSortDir("desc"); }
  }

  // Open rows
  const openRows = useMemo(() => {
    const rows = open.map(t => {
      const ltp      = livePrices[t.ticker];
      const riskAmt  = t.risk_amount ?? 0;
      const riskPct  = totalRisk > 0 ? (riskAmt / totalRisk) * 100 : 0;
      const currentR = ltp !== undefined && riskAmt > 0
        ? ((ltp - t.entry_price) * t.quantity) / riskAmt : null;
      const daysHeld = Math.floor(
        (Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return { trade: t, riskAmt, riskPct, currentR, daysHeld };
    });

    return [...rows].sort((a, b) => {
      let diff = 0;
      switch (openSort) {
        case "time":        diff = new Date(a.trade.created_at).getTime() - new Date(b.trade.created_at).getTime(); break;
        case "risk_amount": diff = a.riskAmt - b.riskAmt; break;
        case "risk_pct":    diff = a.riskPct - b.riskPct; break;
        case "current_r":   diff = (a.currentR ?? -999) - (b.currentR ?? -999); break;
        case "days_held":   diff = a.daysHeld - b.daysHeld; break;
      }
      return sortDir === "desc" ? -diff : diff;
    });
  }, [open, livePrices, totalRisk, openSort, sortDir]);

  // Closed rows
  const closedRows = useMemo(() => {
    const rows = closed.map(t => {
      const pnl = t.realised_pnl ?? 0;
      const r   = t.risk_amount && t.risk_amount > 0 ? pnl / t.risk_amount : null;
      return { trade: t, pnl, r };
    });

    return [...rows].sort((a, b) => {
      let diff = 0;
      switch (closedSort) {
        case "time":   diff = new Date(a.trade.created_at).getTime() - new Date(b.trade.created_at).getTime(); break;
        case "pnl":    diff = a.pnl - b.pnl; break;
        case "r":      diff = (a.r ?? -999) - (b.r ?? -999); break;
        case "ticker": diff = a.trade.ticker.localeCompare(b.trade.ticker); break;
      }
      return sortDir === "desc" ? -diff : diff;
    });
  }, [closed, closedSort, sortDir]);

  function ColHead<T extends string>({
    label, k, currentSort, onSort, right,
  }: { label: string; k?: T; currentSort: T; onSort: (k: T) => void; right?: boolean }) {
    const cls = `pb-2 pr-4 text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500
      ${right ? "text-right" : "text-left"}
      ${k ? "cursor-pointer select-none hover:text-slate-700 dark:text-slate-300 transition-colors" : ""}`;
    return (
      <th className={cls} onClick={k ? () => onSort(k) : undefined}>
        {label}
        {k && <SortIcon active={currentSort === k} dir={sortDir}/>}
      </th>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white dark:bg-slate-800/50 p-5 flex flex-col gap-4">

      {/* Header with tab toggle */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
          <button onClick={() => { setTab("open"); setSortDir("desc"); }}
            className={`px-3 py-1.5 font-medium transition-colors ${
              tab === "open"
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300"
            }`}>
            Open Risk ({open.length})
          </button>
          <button onClick={() => { setTab("closed"); setSortDir("desc"); }}
            className={`px-3 py-1.5 font-medium transition-colors ${
              tab === "closed"
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300"
            }`}>
            Closed History ({closed.length})
          </button>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {tab === "open" ? (
            <>Total at risk: <span className="text-amber-400 font-medium">{formatINR(totalRisk)}</span></>
          ) : (
            <>Realised P&L:{" "}
              <span className={`font-medium ${totalRealisedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalRealisedPnl >= 0 ? "+" : ""}{formatINR(totalRealisedPnl)}
              </span>
            </>
          )}
        </span>
      </div>

      {/* ── Open positions table ── */}
      {tab === "open" && (
        openRows.length === 0 ? (
          <div className="text-sm text-slate-400 dark:text-slate-600 text-center py-8">No open positions.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <ColHead label="Stock"           k="time"        currentSort={openSort} onSort={toggleOpenSort}/>
                  <ColHead label="Risk ₹"          k="risk_amount" currentSort={openSort} onSort={toggleOpenSort}/>
                  <ColHead label="Risk % of pool"  k="risk_pct"    currentSort={openSort} onSort={toggleOpenSort}/>
                  <ColHead label="Current R"       k="current_r"   currentSort={openSort} onSort={toggleOpenSort}/>
                  <ColHead label="Days Held"       k="days_held"   currentSort={openSort} onSort={toggleOpenSort}/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {openRows.map(({ trade, riskAmt, riskPct, currentR, daysHeld }) => {
                  const pos    = currentR !== null && currentR >= 0;
                  const rColor = currentR === null ? "text-slate-400 dark:text-slate-600" : pos ? "text-emerald-400" : "text-red-400";
                  return (
                    <tr key={trade.id} className="hover:bg-slate-100/30 dark:bg-white dark:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {trade.ticker.replace(/\.(NS|BO)$/, "")}
                        </span>
                        <div className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
                          {new Date(trade.created_at).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short",
                          })}
                        </div>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        <span className="text-slate-700 dark:text-slate-300">{formatINR(riskAmt)}</span>
                        <div className="mt-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700 w-20 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500/70"
                            style={{ width: `${Math.min(riskPct, 100)}%` }}/>
                        </div>
                      </td>
                      <td className="py-3 pr-4 tabular-nums text-slate-400 dark:text-slate-500 dark:text-slate-400">{riskPct.toFixed(1)}%</td>
                      <td className={`py-3 pr-4 tabular-nums font-medium ${rColor}`}>
                        {currentR !== null ? `${pos ? "+" : ""}${currentR.toFixed(2)}R` : "—"}
                      </td>
                      <td className="py-3 tabular-nums text-slate-400 dark:text-slate-500 dark:text-slate-400">
                        {daysHeld === 0 ? "Today" : `${daysHeld}d`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 dark:border-slate-700">
                <tr className="text-xs text-slate-400 dark:text-slate-500">
                  <td className="pt-3 text-slate-400 dark:text-slate-500 dark:text-slate-400 font-medium">{openRows.length} positions</td>
                  <td className="pt-3 tabular-nums text-amber-400 font-medium">{formatINR(totalRisk)}</td>
                  <td className="pt-3">100%</td>
                  <td className="pt-3 tabular-nums">
                    {(() => {
                      const valid = openRows.filter(r => r.currentR !== null);
                      if (!valid.length) return "—";
                      const avg = valid.reduce((s, r) => s + (r.currentR ?? 0), 0) / valid.length;
                      return (
                        <span className={avg >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {avg >= 0 ? "+" : ""}{avg.toFixed(2)}R avg
                        </span>
                      );
                    })()}
                  </td>
                  <td className="pt-3"/>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}

      {/* ── Closed history table ── */}
      {tab === "closed" && (
        closedRows.length === 0 ? (
          <div className="text-sm text-slate-400 dark:text-slate-600 text-center py-8">No closed trades yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <ColHead label="Stock"    k="ticker" currentSort={closedSort} onSort={toggleClosedSort}/>
                  <ColHead label="Closed"   k="time"   currentSort={closedSort} onSort={toggleClosedSort}/>
                  <ColHead label="Result"   currentSort={closedSort} onSort={toggleClosedSort}/>
                  <ColHead label="R"        k="r"      currentSort={closedSort} onSort={toggleClosedSort}/>
                  <ColHead label="P&L"      k="pnl"    currentSort={closedSort} onSort={toggleClosedSort} right/>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {closedRows.map(({ trade, pnl, r }) => {
                  const pos = pnl >= 0;
                  return (
                    <tr key={trade.id} className="hover:bg-slate-100/30 dark:bg-white dark:bg-slate-800/30 transition-colors">
                      <td className="py-3 pr-4">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {trade.ticker.replace(/\.(NS|BO)$/, "")}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-400 dark:text-slate-500">
                        {new Date(trade.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`text-xs px-1.5 py-0.5 rounded border
                          ${STATUS_STYLE[trade.status] ?? STATUS_STYLE.CLOSED}`}>
                          {STATUS_LABEL[trade.status] ?? trade.status}
                        </span>
                      </td>
                      <td className={`py-3 pr-4 tabular-nums text-xs font-medium ${
                        r === null ? "text-slate-400 dark:text-slate-600" : pos ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {r !== null ? `${r >= 0 ? "+" : ""}${r.toFixed(2)}R` : "—"}
                      </td>
                      <td className={`py-3 tabular-nums font-semibold text-right ${pos ? "text-emerald-400" : "text-red-400"}`}>
                        {pos ? "+" : ""}{formatINR(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-200 dark:border-slate-700">
                <tr className="text-xs text-slate-400 dark:text-slate-500">
                  <td className="pt-3 text-slate-400 dark:text-slate-500 dark:text-slate-400 font-medium" colSpan={3}>
                    {closedRows.length} trades · {closedRows.filter(r => r.pnl > 0).length}W {closedRows.filter(r => r.pnl < 0).length}L
                  </td>
                  <td className="pt-3 tabular-nums">
                    {(() => {
                      const valid = closedRows.filter(r => r.r !== null);
                      if (!valid.length) return "—";
                      const avg = valid.reduce((s, r) => s + (r.r ?? 0), 0) / valid.length;
                      return (
                        <span className={avg >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {avg >= 0 ? "+" : ""}{avg.toFixed(2)}R avg
                        </span>
                      );
                    })()}
                  </td>
                  <td className={`pt-3 tabular-nums font-semibold text-right ${totalRealisedPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {totalRealisedPnl >= 0 ? "+" : ""}{formatINR(totalRealisedPnl)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  );
}