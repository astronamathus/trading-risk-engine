"use client";

// ============================================================
// app/leaderboard/page.tsx
//
// Members: see only their own group leaderboard (ranks + counts)
// Admins:  can switch between all groups + see full metrics
// Both:    opt-in toggle (admins hidden by default)
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
  on_leaderboard:  boolean;
  total_closed:    number;
  open_trades:     number;
  lifetime_pnl?:   number;
  monthly_pnl?:    number;
  win_rate?:       number | null;
  avg_r?:          number | null;
}

interface OrgGroup {
  id:           string;
  name:         string;
  member_count: number;
  is_my_group:  boolean;
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
  if (rank === 2) return <span className="text-slate-700 dark:text-slate-300 text-sm">🥈</span>;
  if (rank === 3) return <span className="text-amber-700 text-sm">🥉</span>;
  return <span className="text-slate-400 dark:text-slate-600 text-xs w-4 text-center">{rank}</span>;
}

function SortButton({ label, metric, current, onChange }: {
  label: string; metric: SortMetric; current: SortMetric;
  onChange: (m: SortMetric) => void;
}) {
  return (
    <button onClick={() => onChange(metric)}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        current === metric
          ? "bg-blue-600 text-slate-900 dark:text-white"
          : "border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700"
      }`}>
      {label}
    </button>
  );
}

function StatCell({ label, value, positive }: {
  label: string; value: string; positive: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-xs text-slate-400 dark:text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${positive ? "text-emerald-400" : "text-red-400"}`}>
        {value}
      </span>
    </div>
  );
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [groups,       setGroups]       = useState<OrgGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [rows,         setRows]         = useState<LeaderboardRow[]>([]);
  const [isAdmin,      setIsAdmin]      = useState(false);
  const [iAmOnLb,      setIAmOnLb]      = useState(false);
  const [toggling,     setToggling]     = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [sort,         setSort]         = useState<SortMetric>("lifetime_pnl");
  const [orgName,      setOrgName]      = useState("");
  const [orgId,        setOrgId]        = useState<string | null>(null);
  const [noGroup,      setNoGroup]      = useState(false);

  // Load groups first
  const loadGroups = useCallback(async (oId: string) => {
    const { data } = await supabase.rpc("get_org_groups", { p_org_id: oId });
    if (!data?.ok) return [];
    const g: OrgGroup[] = data.groups ?? [];
    setGroups(g);
    return g;
  }, []);

  // Load leaderboard for selected group
  const loadBoard = useCallback(async (groupId: string, sortMetric: SortMetric) => {
    setLoading(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("get_group_leaderboard", {
      p_group_id: groupId,
      p_sort:     sortMetric,
    });
    if (rpcErr) { setError(rpcErr.message); setLoading(false); return; }
    if (!data?.ok) { setError(data?.error ?? "Failed to load"); setLoading(false); return; }
    setIsAdmin(data.is_admin ?? false);
    setIAmOnLb(data.i_am_on_lb ?? false);
    setRows(data.rows ?? []);
    setLoading(false);
  }, []);

  const init = useCallback(async () => {
    if (!user) return;
    const org = await getUserOrg(user.id);
    if (!org) { router.replace("/dashboard"); return; }
    setOrgName(org.name);
    setOrgId(org.id);

    const g = await loadGroups(org.id);

    if (g.length === 0) {
      // No groups exist yet
      setNoGroup(true);
      setLoading(false);
      return;
    }

    // Members: auto-select their own group
    // Admins: select first group by default
    const myGroup  = g.find(gr => gr.is_my_group);
    const startGroup = myGroup ?? g[0];
    setSelectedGroup(startGroup.id);
    await loadBoard(startGroup.id, sort);
  }, [user, router, loadGroups, loadBoard, sort]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    init();
  }, [user, authLoading, init]);

  async function handleSelectGroup(groupId: string) {
    setSelectedGroup(groupId);
    await loadBoard(groupId, sort);
  }

  async function handleSort(metric: SortMetric) {
    setSort(metric);
    if (selectedGroup) await loadBoard(selectedGroup, metric);
  }

  async function handleToggleLeaderboard() {
    if (!orgId) return;
    setToggling(true);
    const newVal = !iAmOnLb;
    try {
      const { data, error } = await supabase.rpc("toggle_leaderboard_visibility", {
        p_org_id: orgId,
        p_show:   newVal,
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error);
      setIAmOnLb(newVal);
      if (selectedGroup) await loadBoard(selectedGroup, sort);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setToggling(false);
    }
  }

  if (authLoading || (loading && !noGroup && rows.length === 0)) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-400 dark:text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading leaderboard…</span>
    </main>
  );

  const visibleRows = rows.filter(r => r.on_leaderboard || r.is_current_user);
  const selectedGroupName = groups.find(g => g.id === selectedGroup)?.name ?? "";
  const myGroup = groups.find(g => g.is_my_group);

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Leaderboard</h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
              {orgName}{selectedGroupName ? ` · ${selectedGroupName}` : ""}
            </p>
          </div>
          <button
            onClick={handleToggleLeaderboard}
            disabled={toggling}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm
              font-medium transition-colors disabled:opacity-50 ${
              iAmOnLb
                ? "border-emerald-700 text-emerald-400 bg-emerald-900/20 hover:bg-emerald-900/40"
                : "border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700"
            }`}>
            {iAmOnLb ? "✓ On leaderboard" : "+ Join leaderboard"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">{error}</div>
        )}

        {/* No groups yet */}
        {noGroup && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center
            flex flex-col gap-3">
            <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm font-medium">No groups set up yet</p>
            <p className="text-slate-400 dark:text-slate-600 text-xs">
              Leaderboards exist within groups. Ask your admin to create groups first.
            </p>
            {isAdmin && (
              <button onClick={() => router.push("/org/groups")}
                className="mx-auto mt-2 px-4 py-2 rounded-xl bg-blue-600 text-sm
                  font-semibold text-slate-900 dark:text-white hover:bg-blue-500 transition-colors">
                Create groups
              </button>
            )}
          </div>
        )}

        {!noGroup && (
          <>
            {/* Group tabs — admins can switch, members see only theirs */}
            {isAdmin && groups.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {groups.map(g => (
                  <button key={g.id} onClick={() => handleSelectGroup(g.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedGroup === g.id
                        ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        : "border border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700"
                    }`}>
                    {g.name}
                    <span className="ml-1.5 text-slate-400 dark:text-slate-500">{g.member_count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Non-admin with no group */}
            {!isAdmin && !myGroup && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/30 dark:bg-white dark:bg-slate-800/30 px-4 py-6
                text-center text-sm text-slate-400 dark:text-slate-500">
                You haven't been assigned to a group yet. Ask your admin.
              </div>
            )}

            {/* Sort controls — admins only */}
            {isAdmin && (
              <div className="flex gap-2 flex-wrap">
                <SortButton label="Lifetime P&L" metric="lifetime_pnl" current={sort} onChange={handleSort}/>
                <SortButton label="Monthly P&L"  metric="monthly_pnl"  current={sort} onChange={handleSort}/>
                <SortButton label="Win Rate"     metric="win_rate"      current={sort} onChange={handleSort}/>
                <SortButton label="Avg R"        metric="avg_r"         current={sort} onChange={handleSort}/>
              </div>
            )}

            {/* Board */}
            {(isAdmin || myGroup) && (
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-white dark:bg-slate-800/50 p-6">
                {loading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-400 dark:text-slate-500 text-sm">
                    <svg className="animate-spin h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Loading…
                  </div>
                ) : visibleRows.length === 0 ? (
                  <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-8">
                    No traders on the board yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {visibleRows.map((row, idx) => (
                      <div key={row.user_id}
                        className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                          row.is_current_user
                            ? "border border-blue-700 bg-blue-900/10"
                            : idx === 0
                              ? "border border-amber-800/50 bg-amber-900/10"
                              : "hover:bg-slate-100/30 dark:bg-slate-200 dark:bg-slate-700/30"
                        }`}>

                        <div className="w-6 flex items-center justify-center shrink-0">
                          <Medal rank={idx + 1}/>
                        </div>

                        {row.avatar_url ? (
                          <img src={row.avatar_url} alt={row.display_name ?? ""}
                            className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"/>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center
                            justify-center text-sm font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            {(row.display_name ?? "?").charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {row.display_name ?? "Trader"}
                            </span>
                            {row.is_current_user && (
                              <span className="text-xs text-slate-400 dark:text-slate-600">(you)</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {row.total_closed} closed · {row.open_trades} open
                          </span>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-6 shrink-0">
                            {sort === "lifetime_pnl" && row.lifetime_pnl !== undefined && (
                              <StatCell label="Lifetime P&L" value={formatINR(row.lifetime_pnl)}
                                positive={row.lifetime_pnl >= 0}/>
                            )}
                            {sort === "monthly_pnl" && row.monthly_pnl !== undefined && (
                              <StatCell label="Monthly P&L" value={formatINR(row.monthly_pnl)}
                                positive={row.monthly_pnl >= 0}/>
                            )}
                            {sort === "win_rate" && (
                              <StatCell label="Win Rate"
                                value={row.win_rate != null ? `${row.win_rate.toFixed(0)}%` : "—"}
                                positive={row.win_rate != null && row.win_rate >= 50}/>
                            )}
                            {sort === "avg_r" && (
                              <StatCell label="Avg R"
                                value={row.avg_r != null
                                  ? `${row.avg_r >= 0 ? "+" : ""}${row.avg_r.toFixed(2)}R` : "—"}
                                positive={row.avg_r != null && row.avg_r >= 0}/>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Ghost row if opted out */}
            {!iAmOnLb && (() => {
              const me = rows.find(r => r.is_current_user);
              if (!me) return null;
              return (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700
                  bg-slate-100/20 dark:bg-white dark:bg-slate-800/20 px-4 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">
                  You are not on the leaderboard. Click "Join leaderboard" to appear.
                  {isAdmin && me.lifetime_pnl !== undefined && (
                    <span className="ml-1">
                      Your P&L:{" "}
                      <span className={me.lifetime_pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {formatINR(me.lifetime_pnl)}
                      </span>
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Admin shortcut to manage groups */}
            {isAdmin && (
              <div className="text-center">
                <button onClick={() => router.push("/org/groups")}
                  className="text-xs text-slate-400 dark:text-slate-600 hover:text-slate-400 dark:text-slate-500 dark:text-slate-400 transition-colors">
                  Manage groups →
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </main>
  );
}