"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter }   from "next/navigation";
import { useAuth }     from "@/components/AuthProvider";
import { getUserOrg }  from "@/lib/db/org";
import { getTrades, updateTradeStatus, deleteTrade } from "@/lib/db/trades";
import { supabase }    from "@/lib/supabase";
import type { Trade }  from "@/lib/db/trades";

interface MemberWithTrades {
  id:       string;
  name:     string;
  email:    string;
  avatar:   string | null;
  trades:   Trade[];
}

function formatINR(v: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(v);
}

function StatusBadge({ status }: { status: Trade["status"] }) {
  const styles: Record<Trade["status"], string> = {
    QUEUED:     "border-amber-700  text-amber-400  bg-amber-900/20",
    OPEN:       "border-emerald-700 text-emerald-400 bg-emerald-900/20",
    CLOSED:     "border-slate-600  text-slate-400  bg-slate-800/40",
    STOPPED:    "border-red-800    text-red-400    bg-red-900/20",
    TARGET_HIT: "border-blue-700   text-blue-400   bg-blue-900/20",
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

// Inline editable trade row
function AdminTradeRow({
  trade,
  onStatusChange,
  onDelete,
  loading,
}: {
  trade:          Trade;
  onStatusChange: (id: string, status: Trade["status"]) => void;
  onDelete:       (id: string) => void;
  loading:        boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

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
          {/* Status change dropdown — admin only */}
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

          {/* Delete */}
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-md text-slate-600 hover:text-red-400
                hover:bg-red-900/20 transition-colors"
              title="Delete trade"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(trade.id)}
                className="px-2 py-1 rounded text-xs bg-red-700 text-white
                  hover:bg-red-600 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded text-xs text-slate-400
                  hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [members,    setMembers]    = useState<MemberWithTrades[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [actionId,   setActionId]   = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [orgName,    setOrgName]    = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    const org = await getUserOrg(user.id);
    if (!org) { router.replace("/dashboard"); return; }
    setOrgName(org.name);

    // Verify admin
    const { data: me } = await supabase
      .from("trader_users")
      .select("org_role")
      .eq("id", user.id)
      .single();

    if (me?.org_role !== "admin") {
      router.replace("/dashboard");
      return;
    }

    // Get all org members
    const { data: orgMembers } = await supabase
      .from("trader_users")
      .select("id, auth_user_id")
      .eq("org_id", org.id);

    if (!orgMembers) { setLoading(false); return; }

    const withTrades = await Promise.all(orgMembers.map(async m => {
      const trades = await getTrades(m.id).catch(() => [] as Trade[]);

      // Get name from auth metadata if available
      let name   = "Trader";
      let email  = "";
      let avatar = null;

      if (m.auth_user_id === user.authId) {
        name   = user.name;
        email  = user.email;
        avatar = user.avatarUrl;
      }

      return { id: m.id, name, email, avatar, trades };
    }));

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

  async function handleDelete(tradeId: string) {
    setActionId(tradeId);
    try {
      await deleteTrade(tradeId);
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

        {/* Per-member sections */}
        {members.map(m => {
          const isExpanded  = expanded === m.id;
          const open        = m.trades.filter(t => t.status === "OPEN").length;
          const closed      = m.trades.filter(
            t => t.status === "CLOSED" || t.status === "STOPPED" || t.status === "TARGET_HIT"
          );
          const lifetimePnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);

          return (
            <section key={m.id}
              className="rounded-2xl border border-slate-700 bg-slate-800/50 overflow-hidden">

              {/* Member header — clickable to expand */}
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
                  {m.avatar ? (
                    <img src={m.avatar} alt={m.name}
                      className="w-7 h-7 rounded-full border border-slate-600"/>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center
                      justify-center text-sm font-bold text-slate-300">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-200">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.email}</p>
                  </div>
                </div>

                {/* Summary stats */}
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

              {/* Trade table — shown when expanded */}
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
                            onDelete={handleDelete}
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
  );
}