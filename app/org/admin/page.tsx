"use client";

// ============================================================
// app/org/admin/page.tsx
//
// Changes vs original:
//   - deleteTrade replaced with adminSoftDeleteTrade (from org.ts)
//     which calls the admin_soft_delete_trade RPC — requires a
//     reason, creates audit log, does not hard-delete the row
//   - Member data uses display_name/avatar_url from trader_users
//     via org_memberships join instead of auth admin API
//   - Admin check uses org_memberships table (multi-org aware)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter }   from "next/navigation";
import { useAuth }     from "@/components/AuthProvider";
import { getUserOrg, adminSoftDeleteTrade } from "@/lib/db/org";
import { getTrades, updateTradeStatus }     from "@/lib/db/trades";
import { supabase }    from "@/lib/supabase";
import type { Trade }  from "@/lib/db/trades";

interface MemberWithTrades {
  id:           string;
  display_name: string | null;
  avatar_url:   string | null;
  org_role:     string;
  trades:       Trade[];
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

function StatusBadge({ status }: { status: Trade["status"] }) {
  const styles: Record<Trade["status"], string> = {
    QUEUED:     "border-amber-700   text-amber-400   bg-amber-900/20",
    OPEN:       "border-emerald-700 text-emerald-400 bg-emerald-900/20",
    CLOSED:     "border-slate-600   text-slate-400   bg-slate-800/40",
    STOPPED:    "border-red-800     text-red-400     bg-red-900/20",
    TARGET_HIT: "border-blue-700    text-blue-400    bg-blue-900/20",
  };
  const labels: Record<Trade["status"], string> = {
    QUEUED: "QUEUED", OPEN: "OPEN", CLOSED: "CLOSED",
    STOPPED: "SL HIT", TARGET_HIT: "TG HIT",
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

// ── Delete reason modal ───────────────────────────────────────
function DeleteReasonModal({
  trade,
  onConfirm,
  onCancel,
}: {
  trade:     Trade;
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
}) {
  const [reason,    setReason]    = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    onConfirm(reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700
        bg-slate-900 shadow-2xl flex flex-col gap-5 p-6">

        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold text-white">Delete trade</h2>
          <p className="text-sm text-slate-400">
            <span className="font-mono font-semibold text-slate-300">
              {trade.ticker}
            </span>{" "}
            will be soft-deleted and hidden from the member's view.
            This action is audited and reversible by a platform admin.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Duplicate entry, entered wrong ticker…"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800
              px-3 py-2 text-slate-100 placeholder:text-slate-500 text-sm
              focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5
              text-sm text-slate-400 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason.trim() || submitting}
            className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {submitting ? "Deleting…" : "Confirm delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin trade row ───────────────────────────────────────────
function AdminTradeRow({
  trade,
  onStatusChange,
  onDeleteRequest,
  loading,
}: {
  trade:           Trade;
  onStatusChange:  (id: string, status: Trade["status"]) => void;
  onDeleteRequest: (trade: Trade) => void;
  loading:         boolean;
}) {
  return (
    <tr className={`border-t border-slate-800 hover:bg-slate-800/30 transition-colors
      ${loading ? "opacity-40 pointer-events-none" : ""}`}>
      <td className="px-4 py-3">
        <span className="font-mono text-sm font-semibold text-slate-200">
          {trade.ticker}
        </span>
        <div className="text-xs text-slate-600 mt-0.5">
          {new Date(trade.created_at).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300 text-sm">
        {formatINR(trade.entry_price)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-400 text-sm">
        {formatINR(trade.stop_loss)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-slate-300 text-sm">
        {trade.quantity.toLocaleString("en-IN")}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-sm">
        {trade.realised_pnl !== null ? (
          <span className={trade.realised_pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
            {trade.realised_pnl >= 0 ? "+" : ""}{formatINR(trade.realised_pnl)}
          </span>
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <StatusBadge status={trade.status}/>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {trade.status === "OPEN" && (
            <select
              onChange={e => {
                if (e.target.value) onStatusChange(trade.id, e.target.value as Trade["status"]);
                e.target.value = "";
              }}
              defaultValue=""
              className="text-xs rounded-lg border border-slate-600 bg-slate-800
                text-slate-400 px-2 py-1 focus:outline-none focus:ring-1
                focus:ring-blue-500 cursor-pointer"
            >
              <option value="" disabled>Change status</option>
              <option value="CLOSED">Mark Closed</option>
              <option value="STOPPED">Mark SL Hit</option>
              <option value="TARGET_HIT">Mark TG Hit</option>
            </select>
          )}

          <button
            onClick={() => onDeleteRequest(trade)}
            className="p-1.5 rounded-md text-slate-600 hover:text-red-400
              hover:bg-red-900/20 transition-colors"
            title="Delete trade (audited)"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [members,        setMembers]        = useState<MemberWithTrades[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [actionId,       setActionId]       = useState<string | null>(null);
  const [expanded,       setExpanded]       = useState<string | null>(null);
  const [orgName,        setOrgName]        = useState("");
  const [orgId,          setOrgId]          = useState<string | null>(null);
  const [deletingTrade,  setDeletingTrade]  = useState<Trade | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const org = await getUserOrg(user.id);
    if (!org) { router.replace("/dashboard"); return; }
    setOrgName(org.name);
    setOrgId(org.id);

    // Verify admin via org_memberships (multi-org aware)
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("org_role")
      .eq("user_id", user.id)
      .eq("org_id", org.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.org_role)) {
      router.replace("/dashboard");
      return;
    }

    // Fetch members with profiles from org_memberships join
    const { data: orgMembers } = await supabase
      .from("org_memberships")
      .select("user_id, org_role, trader_users(id, display_name, avatar_url)")
      .eq("org_id", org.id);

    if (!orgMembers) { setLoading(false); return; }

    const withTrades = await Promise.all(
      orgMembers.map(async (m) => {
        // supabase returns trader_users as object or array depending on join type
        const tu = Array.isArray(m.trader_users) ? m.trader_users[0] : m.trader_users;
        const trades = await getTrades(m.user_id).catch(() => [] as Trade[]);
        return {
          id:           m.user_id,
          display_name: tu?.display_name ?? null,
          avatar_url:   tu?.avatar_url   ?? null,
          org_role:     m.org_role,
          trades,
        };
      })
    );

    setMembers(withTrades);
    setLoading(false);
  }, [user, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    load();
  }, [user, authLoading, load]);

  async function handleStatusChange(tradeId: string, status: Trade["status"]) {
    setActionId(tradeId);
    try {
      await updateTradeStatus(tradeId, status);
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

  if (loading || authLoading) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </main>
  );

  return (
    <>
      {/* Delete reason modal */}
      {deletingTrade && (
        <DeleteReasonModal
          trade={deletingTrade}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingTrade(null)}
        />
      )}

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl flex flex-col gap-6">

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Admin View</h1>
              <p className="text-sm text-slate-400 mt-0.5">{orgName} · All member trades</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push("/org/settings")}
                className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs
                  text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Settings
              </button>
              <button
                onClick={() => router.push("/leaderboard")}
                className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs
                  text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Leaderboard
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
              text-sm text-red-300">{error}</div>
          )}

          {members.map(m => {
            const isExpanded  = expanded === m.id;
            const open        = m.trades.filter(t => t.status === "OPEN").length;
            const closed      = m.trades.filter(
              t => ["CLOSED","STOPPED","TARGET_HIT"].includes(t.status)
            );
            const lifetimePnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
            const displayName = m.display_name ?? "Trader";
            const initials    = displayName.charAt(0).toUpperCase();

            return (
              <section key={m.id}
                className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">

                <button
                  onClick={() => setExpanded(isExpanded ? null : m.id)}
                  className="w-full flex items-center justify-between px-6 py-4
                    hover:bg-slate-700/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-3.5 h-3.5 text-slate-500 transition-transform shrink-0
                        ${isExpanded ? "rotate-90" : ""}`}
                      viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={displayName}
                        className="w-7 h-7 rounded-full border border-slate-600"/>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center
                        justify-center text-sm font-bold text-slate-300">
                        {initials}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-200">{displayName}</p>
                        {m.id === user?.id && (
                          <span className="text-xs text-slate-600">(you)</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 capitalize">{m.org_role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Open</p>
                      <p className="text-sm font-semibold text-slate-200">{open}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Trades</p>
                      <p className="text-sm font-semibold text-slate-200">{m.trades.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Realised P&L</p>
                      <p className={`text-sm font-semibold tabular-nums ${
                        lifetimePnl >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {lifetimePnl >= 0 ? "+" : ""}{formatINR(lifetimePnl)}
                      </p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-700 overflow-x-auto">
                    {m.trades.length === 0 ? (
                      <p className="text-sm text-slate-600 text-center py-8">
                        No trades saved yet.
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-slate-800/80">
                          <tr className="text-xs uppercase tracking-wider text-slate-500">
                            <th className="text-left px-4 py-3">Ticker</th>
                            <th className="text-right px-4 py-3">Entry</th>
                            <th className="text-right px-4 py-3">Stop Loss</th>
                            <th className="text-right px-4 py-3">Qty</th>
                            <th className="text-right px-4 py-3">P&L</th>
                            <th className="text-center px-4 py-3">Status</th>
                            <th className="text-right px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.trades.map(trade => (
                            <AdminTradeRow
                              key={trade.id}
                              trade={trade}
                              loading={actionId === trade.id}
                              onStatusChange={handleStatusChange}
                              onDeleteRequest={setDeletingTrade}
                            />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </section>
            );
          })}

          {members.length === 0 && (
            <div className="text-center py-16 text-slate-600 text-sm">
              No members in this organisation yet.
            </div>
          )}

        </div>
      </main>
    </>
  );
}