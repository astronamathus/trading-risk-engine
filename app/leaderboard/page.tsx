"use client";

// ============================================================
// app/leaderboard/page.tsx
//
// Changes vs original:
//   - Single get_org_leaderboard RPC call instead of per-member
//     getTrades() — much faster, no N+1, fully server-controlled
//   - Members see: rank, name, avatar, trade counts only
//   - Admins see:  above + lifetime/monthly PnL, win rate, avg R
//   - Names and avatars come from display_name/avatar_url on
//     trader_users (stored on login — no admin API required)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter }  from "next/navigation";
import { useAuth }    from "@/components/AuthProvider";
import { getUserOrg } from "@/lib/db/org";
import { supabase }   from "@/lib/supabase";

type SortMetric = "lifetime_pnl" | "monthly_pnl" | "win_rate" | "avg_r";

interface LeaderboardRow {
  rank:            number;
  user_id:         string;
  display_name:    string | null;
  avatar_url:      string | null;
  is_current_user: boolean;
  total_closed:    number;
  open_trades:     number;
  // Admin-only fields (undefined for members)
  lifetime_pnl?:   number;
  monthly_pnl?:    number;
  win_rate?:       number | null;
  avg_r?:          number | null;
}

function formatINR(v: number) {
  const abs = Math.abs(v);
  const str = abs >= 100000
    ? `₹${(abs / 100000).toFixed(2)}L`
    : `₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  return v < 0 ? `-${str}` : str;
}

function Medal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-amber-400 text-sm">🥇</span>;
  if (rank === 2) return <span className="text-slate-300 text-sm">🥈</span>;
  if (rank === 3) return <span className="text-amber-700 text-sm">🥉</span>;
  return <span className="text-slate-600 text-xs w-4 text-center">{rank}</span>;
}

function SortButton({
  label, metric, current, onChange, adminOnly, isAdmin,
}: {
  label:     string;
  metric:    SortMetric;
  current:   SortMetric;
  onChange:  (m: SortMetric) => void;
  adminOnly: boolean;
  isAdmin:   boolean;
}) {
  if (adminOnly && !isAdmin) return null;
  const active = current === metric;
  return (
    <button
      onClick={() => onChange(metric)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "border border-slate-600 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows,    setRows]    = useState<LeaderboardRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sort,    setSort]    = useState<SortMetric>("lifetime_pnl");
  const [orgName, setOrgName] = useState("");
  const [orgId,   setOrgId]   = useState<string | null>(null);

  const load = useCallback(async (sortMetric: SortMetric = sort) => {
    if (!user) return;

    const org = await getUserOrg(user.id);
    if (!org) { router.replace("/dashboard"); return; }
    setOrgName(org.name);
    setOrgId(org.id);

    const { data, error: rpcErr } = await supabase.rpc("get_org_leaderboard", {
      p_org_id: org.id,
      p_sort:   sortMetric,
    });

    if (rpcErr) { setError(rpcErr.message); setLoading(false); return; }
    if (!data?.ok) { setError(data?.error ?? "Failed to load leaderboard"); setLoading(false); return; }

    setIsAdmin(data.is_admin ?? false);
    setRows(data.rows ?? []);
    setLoading(false);
  }, [user, router, sort]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    load();
  }, [user, authLoading, load]);

  // Re-fetch when sort changes (RPC handles ordering server-side)
  function handleSort(metric: SortMetric) {
    setSort(metric);
    if (orgId) {
      setLoading(true);
      load(metric);
    }
  }

  if (loading || authLoading) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading leaderboard…</span>
    </main>
  );

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-6">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Leaderboard</h1>
          <p className="text-sm text-slate-400">
            {orgName} · {isAdmin ? "All metrics visible" : "Rank and trade count only"}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">{error}</div>
        )}

        {/* Sort controls — metric sorts only shown to admins */}
        {isAdmin && (
          <div className="flex gap-2 flex-wrap">
            <SortButton label="Lifetime P&L" metric="lifetime_pnl" current={sort}
              onChange={handleSort} adminOnly isAdmin />
            <SortButton label="Monthly P&L"  metric="monthly_pnl"  current={sort}
              onChange={handleSort} adminOnly isAdmin />
            <SortButton label="Win Rate"     metric="win_rate"      current={sort}
              onChange={handleSort} adminOnly isAdmin />
            <SortButton label="Avg R"        metric="avg_r"         current={sort}
              onChange={handleSort} adminOnly isAdmin />
          </div>
        )}

        {/* Privacy notice for members */}
        {!isAdmin && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 px-4 py-3
            text-xs text-slate-500">
            Rankings are visible to all members. Detailed metrics are admin-only.
          </div>
        )}

        {/* Leaderboard table */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
          {rows.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">No traders yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <div
                  key={row.user_id}
                  className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                    row.is_current_user
                      ? "border border-blue-700 bg-blue-900/10"
                      : row.rank === 1
                        ? "border border-amber-800/50 bg-amber-900/10"
                        : "hover:bg-slate-700/30"
                  }`}
                >
                  {/* Rank */}
                  <div className="w-6 flex items-center justify-center shrink-0">
                    <Medal rank={row.rank}/>
                  </div>

                  {/* Avatar */}
                  {row.avatar_url ? (
                    <img src={row.avatar_url} alt={row.display_name ?? ""}
                      className="w-8 h-8 rounded-full border border-slate-600 shrink-0"/>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center
                      justify-center text-sm font-bold text-slate-300 shrink-0">
                      {(row.display_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Name + trade count */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200 truncate">
                        {row.display_name ?? "Trader"}
                      </span>
                      {row.is_current_user && (
                        <span className="text-xs text-slate-600">(you)</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {row.total_closed} closed · {row.open_trades} open
                    </span>
                  </div>

                  {/* Admin metrics */}
                  {isAdmin && (
                    <div className="flex items-center gap-6 shrink-0">
                      {sort === "lifetime_pnl" && row.lifetime_pnl !== undefined && (
                        <StatCell
                          label="Lifetime P&L"
                          value={formatINR(row.lifetime_pnl)}
                          positive={row.lifetime_pnl >= 0}
                        />
                      )}
                      {sort === "monthly_pnl" && row.monthly_pnl !== undefined && (
                        <StatCell
                          label="Monthly P&L"
                          value={formatINR(row.monthly_pnl)}
                          positive={row.monthly_pnl >= 0}
                        />
                      )}
                      {sort === "win_rate" && (
                        <StatCell
                          label="Win Rate"
                          value={row.win_rate != null ? `${row.win_rate.toFixed(0)}%` : "—"}
                          positive={row.win_rate != null && row.win_rate >= 50}
                        />
                      )}
                      {sort === "avg_r" && (
                        <StatCell
                          label="Avg R"
                          value={row.avg_r != null
                            ? `${row.avg_r >= 0 ? "+" : ""}${row.avg_r.toFixed(2)}R`
                            : "—"}
                          positive={row.avg_r != null && row.avg_r >= 0}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

function StatCell({ label, value, positive }: {
  label: string; value: string; positive: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${
        positive ? "text-emerald-400" : "text-red-400"
      }`}>
        {value}
      </span>
    </div>
  );
}