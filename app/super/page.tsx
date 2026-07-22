"use client";

// ============================================================
// app/super/page.tsx
//
// Super admin dashboard: lists the caller's own orgs only.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth }   from "@/components/AuthProvider";
import { supabase }  from "@/lib/supabase";

interface OrgRow {
  id:           string;
  name:         string;
  slug:         string;
  domain:       string | null;
  currency:     string;
  created_at:   string;
  member_count: number;
  my_role:      string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function BuildingIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="11" rx="1"/>
      <path d="M5 14V9h6v5M8 3V1"/>
      <rect x="5.5" y="5.5" width="2" height="2" rx="0.3"/>
      <rect x="8.5" y="5.5" width="2" height="2" rx="0.3"/>
    </svg>
  );
}

const ROLE_BADGE: Record<string, string> = {
  owner: "border-purple-700 text-purple-400 bg-purple-900/20",
  admin: "border-amber-700  text-amber-400  bg-amber-900/20",
};

export default function SuperAdminPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orgs,    setOrgs]    = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("super_admin_list_orgs");
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data?.ok) throw new Error(data?.error ?? "Failed to load orgs");
      setOrgs(data.orgs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin) { router.replace("/dashboard"); return; }
    load();
  }, [authLoading, isSuperAdmin, router, load]);

  const filtered = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    (o.domain ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const inputClass =
    "rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 " +
    "px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs px-2 py-0.5 rounded-full border border-purple-700
                text-purple-400 bg-purple-900/20 font-medium">
                Super Admin
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              My Organisations
            </h1>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
              {loading ? "Loading…" : `${orgs.length} org${orgs.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => router.push("/super/new")}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5
              text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            New org
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">{error}</div>
        )}

        {/* Search */}
        {!loading && orgs.length > 1 && (
          <input
            type="text"
            placeholder="Search by name or domain…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`${inputClass} w-full`}
          />
        )}

        {/* Orgs list */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3
            text-slate-400 dark:text-slate-500">
            <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700
            p-16 text-center flex flex-col gap-3 items-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {search ? "No orgs match that search." : "No organisations yet."}
            </p>
            {!search && (
              <button
                onClick={() => router.push("/super/new")}
                className="mt-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold
                  text-white hover:bg-blue-500 transition-colors">
                Create your first org
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800/50 overflow-hidden">
            {filtered.map((org, idx) => (
              <div key={org.id}
                className={`flex items-center gap-4 px-6 py-4 transition-colors
                  hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer
                  ${idx !== 0 ? "border-t border-slate-100 dark:border-slate-700/60" : ""}`}
                onClick={() => router.push(`/super/${org.id}`)}>

                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700
                  flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                  <BuildingIcon/>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {org.name}
                    </span>
                    {org.currency !== "INR" && (
                      <span className="shrink-0 text-xs px-1.5 py-0.5 rounded border
                        border-slate-300 dark:border-slate-600 text-slate-400">
                        {org.currency}
                      </span>
                    )}
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded border
                      ${ROLE_BADGE[org.my_role] ?? ROLE_BADGE.admin}`}>
                      {org.my_role}
                    </span>
                  </div>
                  {org.domain && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {org.domain}
                    </p>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-slate-400 dark:text-slate-500">Members</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      {org.member_count}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 dark:text-slate-500">Created</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(org.created_at)}
                    </p>
                  </div>
                </div>

                <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0"
                  viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 4l4 4-4 4"/>
                </svg>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}