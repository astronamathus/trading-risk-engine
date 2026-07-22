"use client";

// ============================================================
// app/super/[orgId]/page.tsx
//
// Super admin: full org snapshot.
// Tab strip: Members | Groups
// Danger zone: delete org (super_admin_delete_org RPC).
// All data from super_admin_get_org_detail RPC.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useAuth }    from "@/components/AuthProvider";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────

interface OrgDetail {
  id:         string;
  name:       string;
  slug:       string;
  domain:     string | null;
  currency:   string;
  created_at: string;
}

interface MemberRow {
  id:            string;
  display_name:  string | null;
  avatar_url:    string | null;
  email:         string | null;
  org_role:      "owner" | "admin" | "member";
  capital_limit: number;
  joined_at:     string;
  group_id:        string | null;
  group_name:      string | null;
  is_super_admin:  boolean;
}

interface GroupRow {
  id:           string;
  name:         string;
  member_count: number;
}

// ── Shared styles ─────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  owner:  "border-purple-400 dark:border-purple-700 text-purple-700 dark:text-purple-400 bg-purple-100/60 dark:bg-purple-900/20",
  admin:  "border-amber-400  dark:border-amber-700  text-amber-700  dark:text-amber-400  bg-amber-100/60  dark:bg-amber-900/20",
  member: "border-slate-300  dark:border-slate-600  text-slate-500  dark:text-slate-400  bg-slate-100/60  dark:bg-slate-800/40",
};
const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", member: "Trader",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatCapital(v: number, currency: string) {
  if (currency === "INR") {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000)   return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
  }
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

// ── Delete modal ───────────────────────────────────────────────

function DeleteOrgModal({ orgName, onConfirm, onCancel, loading }: {
  orgName: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  const [typed, setTyped] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-red-900
        bg-white dark:bg-slate-900 shadow-2xl p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-red-400">Delete organisation</h2>
          <p className="text-sm text-slate-400 mt-2">
            This will permanently delete{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{orgName}</span>.
            All members become indie users. Trade history is preserved. Irreversible.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 dark:text-slate-500">
            Type <span className="font-mono text-slate-700 dark:text-slate-300">{orgName}</span> to confirm
          </label>
          <input
            type="text" value={typed} onChange={e => setTyped(e.target.value)}
            placeholder={orgName} autoFocus
            className="w-full rounded-lg border border-red-900 bg-white dark:bg-slate-800
              px-3 py-2 text-slate-900 dark:text-slate-100 text-sm
              focus:outline-none focus:ring-2 focus:ring-red-700"/>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600
              px-4 py-2.5 text-sm text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800
              transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={typed !== orgName || loading}
            className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-red-600 transition-colors disabled:opacity-40">
            {loading ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

type Tab = "members" | "groups";

export default function SuperAdminOrgDetailPage() {
  const router          = useRouter();
  const { orgId }       = useParams<{ orgId: string }>();

  const { isSuperAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    if (!isSuperAdmin) router.replace("/dashboard");
  }, [isSuperAdmin, authLoading, router]);

  const [org,      setOrg]      = useState<OrgDetail | null>(null);
  const [members,  setMembers]  = useState<MemberRow[]>([]);
  const [groups,   setGroups]   = useState<GroupRow[]>([]);
  const [tab,      setTab]      = useState<Tab>("members");
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDel,      setShowDel]      = useState(false);
  const [coOwnerEmail, setCoOwnerEmail] = useState("");
  const [assigning,    setAssigning]    = useState(false);
  const [assignErr,    setAssignErr]    = useState<string | null>(null);
  const [assignOk,     setAssignOk]     = useState(false);

  const load = useCallback(async () => {
if (!orgId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase
        .rpc("super_admin_get_org_detail", { p_org_id: orgId });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data?.ok) throw new Error(data?.error ?? "Failed to load");
      setOrg(data.org);
      setMembers(data.members ?? []);
      setGroups(data.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
if (authLoading || !isSuperAdmin || !orgId) return;
    load();
  }, [authLoading, isSuperAdmin, orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!orgId) return;
    setDeleting(true);
    try {
      const { data, error: rpcErr } = await supabase
        .rpc("super_admin_delete_org", { p_org_id: orgId });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data?.ok) throw new Error(data?.error ?? "Failed to delete");
      router.replace("/super");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
      setDeleting(false);
      setShowDel(false);
    }
  }

  async function handleAssignCoOwner() {
    if (!coOwnerEmail.trim() || !orgId) return;
    setAssigning(true); setAssignErr(null); setAssignOk(false);
    try {
      const { data, error: rpcErr } = await supabase.rpc("super_admin_assign_co_owner", {
        p_org_id: orgId,
        p_email:  coOwnerEmail.trim().toLowerCase(),
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data?.ok) throw new Error(data?.error ?? "Failed to assign");
      setAssignOk(true);
      setCoOwnerEmail("");
      await load();
    } catch (err) {
      setAssignErr(err instanceof Error ? err.message : "Failed.");
    } finally {
      setAssigning(false);
    }
  }

  if (authLoading || loading) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3
      text-slate-400 dark:text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </main>
  );

  // Group members by role for Members tab
  const owners  = members.filter(m => m.org_role === "owner");
  const admins  = members.filter(m => m.org_role === "admin");
  const traders = members.filter(m => m.org_role === "member");

  return (
    <>
      {showDel && org && (
        <DeleteOrgModal
          orgName={org.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDel(false)}
          loading={deleting}
        />
      )}

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl flex flex-col gap-8">

          {/* Back */}
          <button
            onClick={() => router.push("/super")}
            className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500
              hover:text-slate-700 dark:hover:text-slate-300 transition-colors w-fit">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4L6 8l4 4"/>
            </svg>
            All orgs
          </button>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs px-2 py-0.5 rounded-full border border-purple-400 dark:border-purple-700
                  text-purple-700 dark:text-purple-400 bg-purple-100/60 dark:bg-purple-900/20 font-medium">
                  Super Admin
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {org?.name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 dark:text-slate-500">
                {org?.domain && <span>🌐 {org.domain}</span>}
                <span>{org?.currency}</span>
                <span>Created {org ? formatDate(org.created_at) : "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500
              bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2.5">
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-base">
                {members.filter(m => !m.is_super_admin).length}
              </span>
              members ·
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-base">
                {groups.length}
              </span>
              groups
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
              text-sm text-red-300">{error}</div>
          )}

          {/* Tab strip */}
          <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-700
            bg-slate-100/50 dark:bg-slate-800/50 p-1">
            {(["members", "groups"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize
                  ${tab === t
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}>
                {t === "members"
                  ? `Members (${members.length})`
                  : `Groups (${groups.length})`}
              </button>
            ))}
          </div>

          {/* ── Members tab ─────────────────────────────────── */}
          {tab === "members" && (
            <section className="rounded-2xl border border-slate-200 dark:border-slate-700
              bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-5">

              {members.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
                  No members yet.
                </p>
              ) : (
                <>
                  {/* Super admins shown separately — invisible to regular users */}
                  {members.filter(m => m.is_super_admin).length > 0 && (
                    <MemberGroup
                      label="Super Admin (invisible to members)"
                      rows={members.filter(m => m.is_super_admin)}
                      currency={org?.currency ?? "INR"}
                      dimmed
                    />
                  )}
                  {owners.filter(m => !m.is_super_admin).length > 0 && (
                    <MemberGroup label="Owner" rows={owners.filter(m => !m.is_super_admin)} currency={org?.currency ?? "INR"}/>
                  )}
                  {admins.length  > 0 && <MemberGroup label="Admins"  rows={admins}  currency={org?.currency ?? "INR"}/>}
                  {traders.length > 0 && <MemberGroup label="Traders" rows={traders} currency={org?.currency ?? "INR"}/>}
                </>
              )}

              {/* Co-owner assignment */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-5 mt-2 flex flex-col gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Assign co-owner
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    One non-super-admin owner at a time. Replaces any existing co-owner.
                  </p>
                </div>
                {assignOk && (
                  <div className="rounded-lg border border-emerald-700 bg-emerald-900/20
                    px-3 py-2 text-xs text-emerald-400">
                    Co-owner assigned successfully.
                  </div>
                )}
                {assignErr && (
                  <div className="rounded-lg border border-red-700 bg-red-900/20
                    px-3 py-2 text-xs text-red-400">
                    {assignErr}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="user@email.com"
                    value={coOwnerEmail}
                    onChange={e => { setCoOwnerEmail(e.target.value); setAssignErr(null); setAssignOk(false); }}
                    onKeyDown={e => e.key === "Enter" && handleAssignCoOwner()}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600
                      bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100
                      placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAssignCoOwner}
                    disabled={assigning || !coOwnerEmail.trim()}
                    className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold
                      text-white hover:bg-blue-500 transition-colors disabled:opacity-40">
                    {assigning ? "Assigning…" : "Assign"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ── Groups tab ──────────────────────────────────── */}
          {tab === "groups" && (
            <>
              {groups.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200
                  dark:border-slate-700 p-10 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    No groups set up yet.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {groups.map(g => {
                    const gMembers = members.filter(m => m.group_id === g.id);
                    return (
                      <section key={g.id} className="rounded-2xl border border-slate-200
                        dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                            {g.name}
                          </h3>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            {gMembers.length} member{gMembers.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {gMembers.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {gMembers.map(m => (
                              <MemberRow key={m.id} member={m} currency={org?.currency ?? "INR"}/>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                            No members assigned yet.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}

              {/* Unassigned */}
              {(() => {
                const unassigned = members.filter(m => !m.group_id);
                if (unassigned.length === 0 || groups.length === 0) return null;
                return (
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-700
                    bg-slate-100/30 dark:bg-slate-800/30 p-6 flex flex-col gap-3">
                    <h3 className="text-sm font-medium text-slate-400 dark:text-slate-500">
                      Unassigned ({unassigned.length})
                    </h3>
                    {unassigned.map(m => (
                      <MemberRow key={m.id} member={m} currency={org?.currency ?? "INR"}/>
                    ))}
                  </section>
                );
              })()}
            </>
          )}

          {/* Danger zone */}
          <section className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6
            flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  Delete organisation
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  All members become indie users. Trade history is preserved. Irreversible.
                </p>
              </div>
              <button
                onClick={() => setShowDel(true)}
                className="shrink-0 rounded-xl border border-red-800 px-4 py-2
                  text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors">
                Delete org
              </button>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function MemberGroup({ label, rows, currency, dimmed }: {
  label: string; rows: MemberRow[]; currency: string; dimmed?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1 ${dimmed ? "opacity-60" : ""}`}>
      <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-2">
        {label}
        {dimmed && <span className="text-purple-600 dark:text-purple-400 normal-case tracking-normal font-medium"> only you can see this</span>}
      </p>
      {rows.map(m => <MemberRow key={m.id} member={m} currency={currency}/>)}
    </div>
  );
}

function MemberRow({ member: m, currency }: { member: MemberRow; currency: string }) {
  const initials = (m.display_name ?? m.email ?? "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl
      hover:bg-slate-100/30 dark:hover:bg-slate-700/30 transition-colors">

      {m.avatar_url ? (
        <img src={m.avatar_url} alt={m.display_name ?? ""}
          className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"/>
      ) : (
        <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center
          justify-center text-xs font-bold text-slate-300 shrink-0">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-800 dark:text-slate-200 truncate">
            {m.display_name ?? "Unknown"}
          </span>
          {m.group_name && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded border
              border-blue-400 dark:border-blue-700 text-blue-700 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/20">
              {m.group_name}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
          {m.email ?? "No email"} · joined {formatDate(m.joined_at)}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-2">
        <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLE_BADGE[m.org_role]}`}>
          {ROLE_LABELS[m.org_role]}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-500 tabular-nums">
          {formatCapital(m.capital_limit, currency)}
        </span>
      </div>
    </div>
  );
}