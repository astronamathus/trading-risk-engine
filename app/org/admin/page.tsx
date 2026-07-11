"use client";

// ============================================================
// app/org/admin/page.tsx
// Boss/risk-manager view — see every trader on the desk,
// their live positions and realised PnL, and take admin
// actions on individual trades.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter }              from "next/navigation";
import { useAuth }                from "@/components/AuthProvider";
import { getUserOrg, adminSoftDeleteTrade } from "@/lib/db/org";
import { supabase }               from "@/lib/supabase";
import type { Trade }             from "@/lib/db/trades";

// ── Types ─────────────────────────────────────────────────────
interface Member {
  id:           string;
  display_name: string | null;
  avatar_url:   string | null;
  org_role:     string;
  trades:       Trade[];
}

// ── Helpers ───────────────────────────────────────────────────
function formatINR(v: number) {
  const abs = Math.abs(v);
  const str = abs >= 100_000
    ? `₹${(abs / 100_000).toFixed(2)}L`
    : `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return v < 0 ? `-${str}` : str;
}

function pnlColour(v: number) {
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

// ── Sub-components ────────────────────────────────────────────
function StatusBadge({ status }: { status: Trade["status"] }) {
  const map: Record<Trade["status"], [string, string]> = {
    QUEUED:     ["QUEUED",  "border-amber-700   text-amber-400   bg-amber-900/20"],
    OPEN:       ["OPEN",    "border-emerald-700 text-emerald-400 bg-emerald-900/20"],
    CLOSED:     ["CLOSED",  "border-slate-300 dark:border-slate-600   text-slate-400 dark:text-slate-500 dark:text-slate-400   bg-slate-100/40 dark:bg-white dark:bg-slate-800/40"],
    STOPPED:    ["SL HIT",  "border-red-800     text-red-400     bg-red-900/20"],
    TARGET_HIT: ["TG HIT",  "border-blue-700    text-blue-400    bg-blue-900/20"],
  };
  const [label, cls] = map[status];
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    <img src={url} alt={name}
      className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"/>
  ) : (
    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center
      justify-center text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Delete modal ──────────────────────────────────────────────
function DeleteModal({
  trade, onConfirm, onCancel,
}: {
  trade:     Trade;
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-900 shadow-2xl p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Delete trade</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{trade.ticker}</span>
            {" "}will be soft-deleted and hidden from the trader's view.
            This action is audited.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Duplicate entry, wrong ticker…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800
              px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:text-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5
              text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:bg-white dark:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 text-sm
              font-semibold text-slate-900 dark:text-white hover:bg-red-600 transition-colors
              disabled:opacity-50">
            Confirm delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Trade row ─────────────────────────────────────────────────
function TradeRow({
  trade, busy,
  onStatusChange, onDeleteRequest,
}: {
  trade:           Trade;
  busy:            boolean;
  onStatusChange:  (id: string, status: Trade["status"]) => void;
  onDeleteRequest: (t: Trade) => void;
}) {
  return (
    <tr className={`border-t border-slate-200 dark:border-slate-800 transition-colors
      hover:bg-slate-100/30 dark:bg-white dark:bg-slate-800/30 ${busy ? "opacity-40 pointer-events-none" : ""}`}>
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
          {trade.ticker}
        </span>
        <div className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">
          {new Date(trade.created_at).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300 text-sm">
        {formatINR(trade.entry_price)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm">
        {formatINR(trade.stop_loss)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300 text-sm">
        {trade.quantity.toLocaleString("en-IN")}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm">
        {trade.realised_pnl !== null ? (
          <span className={pnlColour(trade.realised_pnl)}>
            {trade.realised_pnl >= 0 ? "+" : ""}{formatINR(trade.realised_pnl)}
          </span>
        ) : <span className="text-slate-400 dark:text-slate-600">—</span>}
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={trade.status}/>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {/* Status override — only for open trades */}
          {(trade.status === "OPEN" || trade.status === "QUEUED") && (
            <select
              defaultValue=""
              onChange={e => {
                if (e.target.value) onStatusChange(trade.id, e.target.value as Trade["status"]);
                e.target.value = "";
              }}
              className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800
                text-slate-400 dark:text-slate-500 dark:text-slate-400 px-2 py-1 focus:outline-none focus:ring-1
                focus:ring-blue-500 cursor-pointer"
            >
              <option value="" disabled>Override</option>
              <option value="CLOSED">Mark Closed</option>
              <option value="STOPPED">Mark SL Hit</option>
              <option value="TARGET_HIT">Mark TG Hit</option>
            </select>
          )}
          {/* Soft delete */}
          <button
            onClick={() => onDeleteRequest(trade)}
            title="Soft delete (audited)"
            className="p-1.5 rounded-md text-slate-400 dark:text-slate-600 hover:text-red-400
              hover:bg-red-900/20 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.4"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Member card ───────────────────────────────────────────────
function MemberCard({
  member, isExpanded, onToggle, actionId,
  onStatusChange, onDeleteRequest,
}: {
  member:          Member;
  isExpanded:      boolean;
  onToggle:        () => void;
  actionId:        string | null;
  onStatusChange:  (id: string, status: Trade["status"]) => void;
  onDeleteRequest: (t: Trade) => void;
}) {
  const name        = member.display_name ?? "Trader";
  const closed      = member.trades.filter(t =>
    ["CLOSED","STOPPED","TARGET_HIT"].includes(t.status)
  );
  const open        = member.trades.filter(t => t.status === "OPEN");
  const queued      = member.trades.filter(t => t.status === "QUEUED");
  const lifetimePnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
  const winRate     = closed.length > 0
    ? Math.round(closed.filter(t => (t.realised_pnl ?? 0) > 0).length / closed.length * 100)
    : null;

  const roleBadge =
    member.org_role === "owner" ? "text-purple-400 border-purple-700 bg-purple-900/20" :
    member.org_role === "admin" ? "text-amber-400  border-amber-700  bg-amber-900/20"  :
                                  "text-slate-400 dark:text-slate-500 dark:text-slate-400  border-slate-300 dark:border-slate-600  bg-slate-100/30 dark:bg-white dark:bg-slate-800/30";

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white dark:bg-slate-800/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4
          hover:bg-slate-100/30 dark:bg-slate-200 dark:bg-slate-700/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-3.5 h-3.5 text-slate-400 dark:text-slate-500 transition-transform shrink-0
            ${isExpanded ? "rotate-90" : ""}`}
            viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <Avatar name={name} url={member.avatar_url}/>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded border capitalize ${roleBadge}`}>
                {member.org_role}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              <span>{open.length} open</span>
              {queued.length > 0 && <span>{queued.length} queued</span>}
              <span>{closed.length} closed</span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-6 shrink-0">
          {winRate !== null && (
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400 dark:text-slate-500">Win rate</p>
              <p className={`text-sm font-semibold ${winRate >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                {winRate}%
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-xs text-slate-400 dark:text-slate-500">Realised P&L</p>
            <p className={`text-sm font-semibold tabular-nums ${pnlColour(lifetimePnl)}`}>
              {lifetimePnl >= 0 ? "+" : ""}{formatINR(lifetimePnl)}
            </p>
          </div>
        </div>
      </button>

      {/* Trade table */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
          {member.trades.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-10">
              No trades yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100/80 dark:bg-white dark:bg-slate-800/80">
                <tr className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  <th className="text-left  px-4 py-3">Ticker</th>
                  <th className="text-right px-4 py-3">Entry</th>
                  <th className="text-right px-4 py-3">Stop Loss</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">P&L</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {member.trades.map(trade => (
                  <TradeRow
                    key={trade.id}
                    trade={trade}
                    busy={actionId === trade.id}
                    onStatusChange={onStatusChange}
                    onDeleteRequest={onDeleteRequest}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [members,       setMembers]       = useState<Member[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [actionId,      setActionId]      = useState<string | null>(null);
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [orgName,       setOrgName]       = useState("");
  const [orgId,         setOrgId]         = useState<string | null>(null);
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);

    try {
      const org = await getUserOrg(user.id);
      if (!org) { router.replace("/dashboard"); return; }
      setOrgName(org.name);
      setOrgId(org.id);

      // Role check from app context (no extra DB round-trip)
      if (user.userType !== "org_admin") {
        router.replace("/dashboard");
        return;
      }

      // Fetch all members + profiles (RLS disabled on org_memberships)
      const { data: memberships, error: mErr } = await supabase
        .from("org_memberships")
        .select("user_id, org_role, trader_users(id, display_name, avatar_url)")
        .eq("org_id", org.id);

      if (mErr || !memberships) {
        setError(`Failed to load members: ${mErr?.message}`);
        setLoading(false);
        return;
      }

      // Fetch trades for each member (RLS disabled on trades)
      const withTrades = await Promise.all(
        memberships.map(async (m) => {
          const tu = Array.isArray(m.trader_users)
            ? m.trader_users[0]
            : m.trader_users as { id: string; display_name: string | null; avatar_url: string | null } | null;

          const { data: trades, error: tErr } = await supabase
            .from("trades")
            .select("*")
            .eq("user_id", m.user_id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (tErr) console.error("Trades fetch error:", tErr.message);

          return {
            id:           m.user_id,
            display_name: tu?.display_name ?? null,
            avatar_url:   tu?.avatar_url   ?? null,
            org_role:     m.org_role,
            trades:       (trades ?? []) as Trade[],
          } satisfies Member;
        })
      );

      // Sort: most open positions first
      withTrades.sort((a, b) =>
        b.trades.filter(t => t.status === "OPEN").length -
        a.trades.filter(t => t.status === "OPEN").length
      );

      setMembers(withTrades);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    load();
  }, [user, authLoading, load]);

  async function handleStatusChange(tradeId: string, status: Trade["status"]) {
    setActionId(tradeId);
    try {
      const { error } = await supabase
        .from("trades")
        .update({ status })
        .eq("id", tradeId);
      if (error) throw new Error(error.message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update trade.");
    } finally {
      setActionId(null);
    }
  }

  async function handleDeleteConfirm(reason: string) {
    if (!deletingTrade || !orgId) return;
    const tradeId = deletingTrade.id;
    setDeletingTrade(null);
    setActionId(tradeId);
    try {
      await adminSoftDeleteTrade(tradeId, orgId, reason);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete trade.");
    } finally {
      setActionId(null);
    }
  }

  // ── Aggregate stats ────────────────────────────────────────
  const totalOpen     = members.reduce((s, m) =>
    s + m.trades.filter(t => t.status === "OPEN").length, 0);
  const totalRisk     = members.reduce((s, m) =>
    s + m.trades.filter(t => t.status === "OPEN")
      .reduce((r, t) => r + (t.risk_amount ?? 0), 0), 0);
  const totalPnl      = members.reduce((s, m) =>
    s + m.trades.filter(t => ["CLOSED","STOPPED","TARGET_HIT"].includes(t.status))
      .reduce((r, t) => r + (t.realised_pnl ?? 0), 0), 0);

  if (loading || authLoading) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-400 dark:text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading team…</span>
    </main>
  );

  return (
    <>
      {deletingTrade && (
        <DeleteModal
          trade={deletingTrade}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingTrade(null)}
        />
      )}

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex flex-col gap-6">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Team Overview
              </h1>
              <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-0.5">
                {orgName} · {members.length} trader{members.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => router.push("/leaderboard")}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs
                  text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700 transition-colors">
                Leaderboard
              </button>
              <button onClick={() => router.push("/org/settings")}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs
                  text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700 transition-colors">
                Settings
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/30
              px-4 py-3 text-sm text-red-300">{error}</div>
          )}

          {/* Desk summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Open Positions", value: totalOpen.toString(),      colour: "text-slate-800 dark:text-slate-200" },
              { label: "Total Risk",     value: formatINR(totalRisk),      colour: "text-amber-400" },
              { label: "Desk P&L",       value: formatINR(totalPnl),       colour: pnlColour(totalPnl) },
            ].map(({ label, value, colour }) => (
              <div key={label}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white dark:bg-slate-800/50 px-5 py-4">
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-bold tabular-nums mt-1 ${colour}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Member cards */}
          {members.length === 0 ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-600 text-sm">
              No members yet. Generate an invite from{" "}
              <button onClick={() => router.push("/org/settings")}
                className="text-slate-400 dark:text-slate-500 dark:text-slate-400 underline hover:text-slate-800 dark:text-slate-200">
                Settings
              </button>.
            </div>
          ) : (
            members.map(m => (
              <MemberCard
                key={m.id}
                member={m}
                isExpanded={expanded === m.id}
                onToggle={() => setExpanded(expanded === m.id ? null : m.id)}
                actionId={actionId}
                onStatusChange={handleStatusChange}
                onDeleteRequest={setDeletingTrade}
              />
            ))
          )}

        </div>
      </main>
    </>
  );
}