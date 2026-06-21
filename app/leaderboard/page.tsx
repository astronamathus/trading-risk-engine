"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter }  from "next/navigation";
import { useAuth }    from "@/components/AuthProvider";
import { getUserOrg } from "@/lib/db/org";
import { getTrades }  from "@/lib/db/trades";
import { supabase }   from "@/lib/supabase";
import type { Trade } from "@/lib/db/trades";

type SortMetric = "lifetime_pnl" | "monthly_pnl" | "win_rate" | "avg_r";

interface MemberStats {
  id:          string;
  name:        string;
  avatarUrl:   string | null;
  email:       string;
  isCurrentUser: boolean;
  lifetimePnl: number;
  monthlyPnl:  number;
  winRate:     number | null;
  avgR:        number | null;
  totalTrades: number;
  openTrades:  number;
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
  label, metric, current, onChange,
}: {
  label: string; metric: SortMetric;
  current: SortMetric; onChange: (m: SortMetric) => void;
}) {
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

  const [stats,   setStats]   = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sort,    setSort]    = useState<SortMetric>("lifetime_pnl");
  const [orgName, setOrgName] = useState<string>("");

  const load = useCallback(async () => {
    if (!user) return;

    // Must be in an org
    const org = await getUserOrg(user.id);
    if (!org) { router.replace("/dashboard"); return; }
    setOrgName(org.name);

    // Get all members of the org
    const { data: members } = await supabase
      .from("trader_users")
      .select("id, auth_user_id, org_role")
      .eq("org_id", org.id);

    if (!members) { setLoading(false); return; }

    const now       = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // For each member, fetch trades and compute stats
    const allStats = await Promise.all(members.map(async m => {
      // Get auth user metadata
      const { data: session } = await supabase.auth.getUser();
      const isSelf = m.auth_user_id === user.authId;

      // Fetch trades for this member
      const trades = await getTrades(m.id).catch(() => [] as Trade[]);

      const closed = trades.filter(
        t => t.status === "CLOSED" || t.status === "STOPPED" || t.status === "TARGET_HIT"
      );
      const open   = trades.filter(t => t.status === "OPEN");

      const lifetimePnl = closed.reduce((s, t) => s + (t.realised_pnl ?? 0), 0);
      const monthlyPnl  = closed
        .filter(t => t.created_at >= monthStart)
        .reduce((s, t) => s + (t.realised_pnl ?? 0), 0);

      const winners  = closed.filter(t => (t.realised_pnl ?? 0) > 0);
      const winRate  = closed.length > 0
        ? (winners.length / closed.length) * 100
        : null;

      const rValues = closed
        .map(t => t.risk_amount && t.risk_amount > 0
          ? (t.realised_pnl ?? 0) / t.risk_amount
          : null)
        .filter((r): r is number => r !== null);
      const avgR = rValues.length > 0
        ? rValues.reduce((s, r) => s + r, 0) / rValues.length
        : null;

      // Get name from session if self, otherwise from stored metadata
      let name      = "Trader";
      let avatarUrl = null;
      let email     = "";

      if (isSelf && session?.user) {
        name      = session.user.user_metadata?.full_name ?? "You";
        avatarUrl = session.user.user_metadata?.avatar_url ?? null;
        email     = session.user.email ?? "";
      }

      return {
        id:           m.id,
        name,
        avatarUrl,
        email,
        isCurrentUser: isSelf,
        lifetimePnl,
        monthlyPnl,
        winRate,
        avgR,
        totalTrades:  closed.length,
        openTrades:   open.length,
      } as MemberStats;
    }));

    setStats(allStats);
    setLoading(false);
  }, [user, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace("/auth"); return; }
    load();
  }, [user, authLoading, load]);

  const sorted = [...stats].sort((a, b) => {
    switch (sort) {
      case "lifetime_pnl": return b.lifetimePnl - a.lifetimePnl;
      case "monthly_pnl":  return b.monthlyPnl  - a.monthlyPnl;
      case "win_rate":     return (b.winRate ?? -1) - (a.winRate ?? -1);
      case "avg_r":        return (b.avgR    ?? -999) - (a.avgR ?? -999);
    }
  });

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
          <p className="text-sm text-slate-400">{orgName} · All traders ranked</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">{error}</div>
        )}

        {/* Sort controls */}
        <div className="flex gap-2 flex-wrap">
          <SortButton label="Lifetime P&L" metric="lifetime_pnl" current={sort} onChange={setSort}/>
          <SortButton label="Monthly P&L"  metric="monthly_pnl"  current={sort} onChange={setSort}/>
          <SortButton label="Win Rate"     metric="win_rate"      current={sort} onChange={setSort}/>
          <SortButton label="Avg R"        metric="avg_r"         current={sort} onChange={setSort}/>
        </div>

        {/* Leaderboard table */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6">
          {sorted.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">No traders yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sorted.map((s, idx) => {
                const isTop = idx === 0;
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-4 p-3 rounded-xl transition-colors ${
                      s.isCurrentUser
                        ? "border border-blue-700 bg-blue-900/10"
                        : isTop
                          ? "border border-amber-800/50 bg-amber-900/10"
                          : "hover:bg-slate-700/30"
                    }`}
                  >
                    {/* Rank */}
                    <div className="w-6 flex items-center justify-center shrink-0">
                      <Medal rank={idx + 1}/>
                    </div>

                    {/* Avatar */}
                    {s.avatarUrl ? (
                      <img src={s.avatarUrl} alt={s.name}
                        className="w-8 h-8 rounded-full border border-slate-600 shrink-0"/>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center
                        justify-center text-sm font-bold text-slate-300 shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {s.name}
                        </span>
                        {s.isCurrentUser && (
                          <span className="text-xs text-slate-600">(you)</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">
                        {s.totalTrades} closed · {s.openTrades} open
                      </span>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 shrink-0">
                      {sort === "lifetime_pnl" && (
                        <StatCell
                          label="Lifetime P&L"
                          value={formatINR(s.lifetimePnl)}
                          positive={s.lifetimePnl >= 0}
                        />
                      )}
                      {sort === "monthly_pnl" && (
                        <StatCell
                          label="Monthly P&L"
                          value={formatINR(s.monthlyPnl)}
                          positive={s.monthlyPnl >= 0}
                        />
                      )}
                      {sort === "win_rate" && (
                        <StatCell
                          label="Win Rate"
                          value={s.winRate !== null ? `${s.winRate.toFixed(0)}%` : "—"}
                          positive={s.winRate !== null && s.winRate >= 50}
                        />
                      )}
                      {sort === "avg_r" && (
                        <StatCell
                          label="Avg R"
                          value={s.avgR !== null
                            ? `${s.avgR >= 0 ? "+" : ""}${s.avgR.toFixed(2)}R`
                            : "—"}
                          positive={s.avgR !== null && s.avgR >= 0}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

function StatCell({
  label, value, positive,
}: { label: string; value: string; positive: boolean }) {
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