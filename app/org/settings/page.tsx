"use client";

// ============================================================
// app/org/settings/page.tsx
// Members | Groups tab strip merged into one Team page.
// Changes:
//   - Tab strip: "Members" | "Groups"
//   - Groups member_count bug fixed: local members array
//     filtered by group_id, not stale RPC member_count
//   - Admin capital adjustment per member (set_user_capital_limit)
//   - CalculatorForm: "Trade Settings" panel label, R:R ratio
//     replacing capital input, gear icon already correct
// ============================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter }   from "next/navigation";
import { useAuth }     from "@/components/AuthProvider";
import { supabase }    from "@/lib/supabase";
import {
  getUserOrg, getOrgMembers, createInvite,
  promoteMember, removeMember,
  renameOrganisation, deleteOrganisation,
  setUserCapitalLimit,
} from "@/lib/db/org";
import type { Organisation, OrgMember } from "@/lib/db/org";

// ── Groups types (merged from groups/page.tsx) ────────────────

interface OrgGroup {
  id:           string;
  name:         string;
  member_count: number;
  is_my_group:  boolean;
}

interface OrgMemberWithGroup extends OrgMember {
  group_id:   string | null;
  group_name: string | null;
}

// ── Shared styles ─────────────────────────────────────────────

const inputClass =
  "rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 " +
  "placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner", admin: "Admin", member: "Trader",
};
const ROLE_BADGE: Record<string, string> = {
  owner:  "border-purple-700 text-purple-400 bg-purple-900/20",
  admin:  "border-amber-700  text-amber-400  bg-amber-900/20",
  member: "border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-400 bg-slate-100/40 dark:bg-slate-800/40",
};

// ── Icons ─────────────────────────────────────────────────────

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5"/>
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13H3v-2L11.5 2.5z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2.5A.5.5 0 0 1 5.5 2h5a.5.5 0 0 1 .5.5V4M6 7v5M10 7v5M3 4l1 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-9"/>
    </svg>
  );
}

// ── Delete org modal ──────────────────────────────────────────

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
          <p className="text-sm text-slate-400 dark:text-slate-400 mt-2">
            This will permanently delete{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{orgName}</span>.
            All members become indie users. Trade history is preserved. Irreversible.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-slate-400 dark:text-slate-500">
            Type <span className="font-mono text-slate-700 dark:text-slate-300">{orgName}</span> to confirm
          </label>
          <input type="text" value={typed} onChange={e => setTyped(e.target.value)}
            placeholder={orgName} autoFocus
            className="w-full rounded-lg border border-red-900 bg-white dark:bg-slate-800
              px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:text-slate-600 text-sm
              focus:outline-none focus:ring-2 focus:ring-red-700"/>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5
              text-sm text-slate-400 dark:text-slate-400 hover:bg-white dark:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={typed !== orgName || loading}
            className="flex-1 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold
              text-slate-900 dark:text-white hover:bg-red-600 transition-colors disabled:opacity-40">
            {loading ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Capital edit modal ────────────────────────────────────────

function CapitalModal({ member, orgId, onDone, onCancel }: {
  member: OrgMember; orgId: string;
  onDone: () => void; onCancel: () => void;
}) {
  const [value,   setValue]   = useState(String(member.capital_limit ?? 100000));
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  async function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setErr("Enter a valid positive amount."); return; }
    setSaving(true);
    try {
      await setUserCapitalLimit(orgId, member.id, num);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700
        bg-white dark:bg-slate-900 shadow-2xl p-6 flex flex-col gap-5">
        <div>
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
            Set capital limit
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {member.display_name ?? "This member"}&apos;s maximum trading capital.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400 dark:text-slate-500">Capital (₹)</label>
          <input
            type="number" min="1" step="1000"
            value={value}
            onChange={e => { setValue(e.target.value); setErr(null); }}
            onKeyDown={e => e.key === "Enter" && handleSave()}
            autoFocus
            className={inputClass + " w-full"}
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={saving}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5
              text-sm text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-blue-500 transition-colors disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

type Tab = "members" | "groups";

export default function OrgSettingsPage() {
  const { user, loading: authLoading, refresh } = useAuth();
  const router = useRouter();

  const [tab,     setTab]     = useState<Tab>("members");
  const [org,     setOrg]     = useState<Organisation | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersWithGroups, setMembersWithGroups] = useState<OrgMemberWithGroup[]>([]);
  const [groups,  setGroups]  = useState<OrgGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Rename
  const [editingName, setEditingName] = useState(false);
  const [newName,     setNewName]     = useState("");
  const [renaming,    setRenaming]    = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Invite
  const [inviteRole,    setInviteRole]    = useState<"member" | "admin">("member");
  const [inviteExpiry,  setInviteExpiry]  = useState(7);
  const [inviteMaxUses, setInviteMaxUses] = useState<number | "unlimited">(1);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating,    setGenerating]    = useState(false);
  const [copied,        setCopied]        = useState(false);

  // Delete org
  const [showDelete, setShowDelete] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  // Member actions
  const [actionId,  setActionId]  = useState<string | null>(null);
  const [capitalMember, setCapitalMember] = useState<OrgMember | null>(null);

  // Groups state
  const [newGroupName, setNewGroupName] = useState("");
  const [creating,     setCreating]     = useState(false);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editName,     setEditName]     = useState("");

  const myRole  = members.find(m => m.id === user?.id)?.org_role;
  const isOwner = myRole === "owner";
  const isAdmin = myRole === "owner" || myRole === "admin";

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const orgData = await getUserOrg(user.id);
      if (!orgData) { router.replace("/onboarding"); return; }
      setOrg(orgData);
      setNewName(orgData.name);

      // Members (with capital_limit from RPC)
      const memberData = await getOrgMembers(orgData.id);
      setMembers(memberData);

      // Groups
      const { data: gData } = await supabase.rpc("get_org_groups", { p_org_id: orgData.id });
      const groupList: OrgGroup[] = gData?.ok ? (gData.groups ?? []) : [];
      if (gData?.ok) setGroups(groupList);

      // Members with group assignments — filter by group_id IN this org's groups
      const { data: mData } = await supabase
        .from("org_memberships")
        .select("user_id, org_role, trader_users(id, display_name, avatar_url, capital_limit)")
        .eq("org_id", orgData.id);

      // ── Group membership ────────────────────────────────────
      // Use get_group_leaderboard per group — the same RPC the leaderboard
      // page uses successfully. It returns rows with user_id for each group.
      const groupMap: Record<string, { group_id: string; group_name: string }> = {};

      await Promise.all(
        groupList.map(async (g: OrgGroup) => {
          const { data: lbData } = await supabase.rpc("get_group_leaderboard", {
            p_group_id: g.id,
            p_sort:     "lifetime_pnl",
          });
          if (lbData?.ok && Array.isArray(lbData.rows)) {
            lbData.rows.forEach((row: { user_id: string }) => {
              groupMap[row.user_id] = { group_id: g.id, group_name: g.name };
            });
          }
        })
      );

      const enriched: OrgMemberWithGroup[] = (mData ?? []).map((m: any) => {
        const tu = Array.isArray(m.trader_users) ? m.trader_users[0] : m.trader_users;
        const gm = groupMap[m.user_id];
        // Find base member for capital_limit
        const base = memberData.find(mb => mb.id === m.user_id);
        return {
          id:            m.user_id,
          display_name:  tu?.display_name ?? null,
          avatar_url:    tu?.avatar_url   ?? null,
          org_role:      m.org_role,
          joined_at:     "",
          capital_limit: base?.capital_limit ?? tu?.capital_limit ?? 100000,
          group_id:      gm?.group_id   ?? null,
          group_name:    gm?.group_name ?? null,
        };
      });
      setMembersWithGroups(enriched);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user)                         { router.replace("/auth");       return; }
    if (user.userType !== "org_admin") { router.replace("/dashboard"); return; }
    load();
  }, [user, authLoading, load]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  async function handleRename() {
    if (!org || !newName.trim() || newName.trim() === org.name) {
      setEditingName(false); setNewName(org?.name ?? ""); return;
    }
    setRenaming(true);
    try { await renameOrganisation(org.id, newName.trim()); await load(); setEditingName(false); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to rename."); }
    finally { setRenaming(false); }
  }

  async function handleGenerateInvite() {
    if (!user || !org) return;
    setGenerating(true); setGeneratedCode(null); setError(null);
    try {
      const invite = await createInvite(
        org.id, user.id, inviteRole,
        inviteMaxUses === "unlimited" ? null : inviteMaxUses,
        inviteExpiry,
      );
      setGeneratedCode(invite.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invite.");
    } finally { setGenerating(false); }
  }

  function copyInviteLink() {
    if (!generatedCode) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${generatedCode}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!org) return;
    setDeleting(true);
    try { await deleteOrganisation(org.id); await refresh(); router.replace("/onboarding"); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to delete organisation."); setDeleting(false); setShowDelete(false); }
  }

  async function handlePromote(memberId: string) {
    if (!org) return; setActionId(memberId);
    try { await promoteMember(memberId, org.id, "admin"); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to promote."); }
    finally { setActionId(null); }
  }

  async function handleDemote(memberId: string) {
    if (!org) return; setActionId(memberId);
    try { await promoteMember(memberId, org.id, "member"); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to demote."); }
    finally { setActionId(null); }
  }

  async function handleRemove(memberId: string) {
    if (!org || !confirm("Remove this member from the organisation?")) return;
    setActionId(memberId);
    try { await removeMember(memberId, org.id); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to remove."); }
    finally { setActionId(null); }
  }

  // ── Groups handlers ──────────────────────────────────────────

  async function handleCreateGroup() {
    if (!org || !newGroupName.trim()) return;
    setCreating(true); setError(null);
    try {
      const { data } = await supabase.rpc("create_group", { p_org_id: org.id, p_name: newGroupName.trim() });
      if (!data?.ok) throw new Error(data?.error ?? "Failed to create group");
      setNewGroupName(""); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to create group."); }
    finally { setCreating(false); }
  }

  async function handleRenameGroup(groupId: string) {
    if (!editName.trim()) { setEditingGroup(null); return; }
    setActionId(groupId);
    try {
      const { data } = await supabase.rpc("rename_group", { p_group_id: groupId, p_new_name: editName.trim() });
      if (!data?.ok) throw new Error(data?.error ?? "Failed to rename");
      setEditingGroup(null); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to rename group."); }
    finally { setActionId(null); }
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    if (!confirm(`Delete group "${groupName}"? Members will be unassigned.`)) return;
    setActionId(groupId);
    try {
      const { data } = await supabase.rpc("delete_group", { p_group_id: groupId });
      if (!data?.ok) throw new Error(data?.error ?? "Failed to delete");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to delete group."); }
    finally { setActionId(null); }
  }

  async function handleSetMemberGroup(memberId: string, groupId: string | null) {
    setActionId(memberId);
    try {
      if (groupId) {
        const { data } = await supabase.rpc("set_group_member", { p_group_id: groupId, p_member_id: memberId });
        if (!data?.ok) throw new Error(data?.error ?? "Failed to assign");
      } else {
        const member = membersWithGroups.find(m => m.id === memberId);
        if (member?.group_id) {
          const { data } = await supabase.rpc("remove_group_member", { p_group_id: member.group_id, p_member_id: memberId });
          if (!data?.ok) throw new Error(data?.error ?? "Failed to remove");
        }
      }
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to update member group."); }
    finally { setActionId(null); }
  }

  if (loading || authLoading) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-400 dark:text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading…</span>
    </main>
  );

  const owners  = members.filter(m => m.org_role === "owner");
  const admins  = members.filter(m => m.org_role === "admin");
  const traders = members.filter(m => m.org_role === "member");

  // Groups tab: use membersWithGroups for accurate local filtering
  // BUG FIX: don't rely on group.member_count from RPC — filter locally
  const unassigned = membersWithGroups.filter(m => !m.group_id);

  return (
    <>
      {showDelete && org && (
        <DeleteOrgModal orgName={org.name} onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)} loading={deleting}/>
      )}
      {capitalMember && org && (
        <CapitalModal
          member={capitalMember}
          orgId={org.id}
          onDone={async () => { setCapitalMember(null); await load(); }}
          onCancel={() => setCapitalMember(null)}
        />
      )}

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl flex flex-col gap-8">

          {/* ── Header ──────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {editingName ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter")  handleRename();
                      if (e.key === "Escape") { setEditingName(false); setNewName(org?.name ?? ""); }
                    }}
                    className="text-xl font-bold bg-transparent border-b-2 border-blue-500
                      text-slate-900 dark:text-white focus:outline-none flex-1 min-w-0 pb-0.5"
                  />
                  <button onClick={handleRename} disabled={renaming}
                    className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white
                      hover:bg-blue-500 transition-colors disabled:opacity-50 shrink-0">
                    {renaming ? "…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNewName(org?.name ?? ""); }}
                    className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 shrink-0">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                    {org?.name}
                  </h1>
                  {isOwner && (
                    <button onClick={() => setEditingName(true)}
                      className="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:text-slate-300
                        hover:bg-slate-200 dark:bg-slate-700 transition-colors shrink-0">
                      <PencilIcon/>
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className={`shrink-0 text-xs px-2 py-1 rounded-full border
              ${ROLE_BADGE[myRole ?? "admin"]}`}>
              {ROLE_LABELS[myRole ?? "admin"]}
            </span>
          </div>

          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
              text-sm text-red-300">{error}</div>
          )}

          {/* ── Tab strip ───────────────────────────────────── */}
          <div className="flex gap-1 rounded-xl border border-slate-200 dark:border-slate-700
            bg-slate-100/50 dark:bg-slate-800/50 p-1">
            {(["members", "groups"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors capitalize
                  ${tab === t
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}>
                {t === "members" ? `Members (${members.length})` : `Groups (${groups.length})`}
              </button>
            ))}
          </div>

          {/* ══════════════ MEMBERS TAB ══════════════════════ */}
          {tab === "members" && (
            <>
              {/* Invite */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6
                flex flex-col gap-5">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Generate Invite Link</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role</label>
                    <select value={inviteRole}
                      onChange={e => setInviteRole(e.target.value as "member" | "admin")}
                      className={`${inputClass} w-full`}>
                      <option value="member">Member (trader)</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Expires in</label>
                    <select value={inviteExpiry} onChange={e => setInviteExpiry(Number(e.target.value))}
                      className={`${inputClass} w-full`}>
                      <option value={1}>1 day</option>
                      <option value={7}>7 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider">Max uses</label>
                    <select value={inviteMaxUses}
                      onChange={e => setInviteMaxUses(e.target.value === "unlimited" ? "unlimited" : Number(e.target.value))}
                      className={`${inputClass} w-full`}>
                      <option value={1}>1 (single use)</option>
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value="unlimited">Unlimited</option>
                    </select>
                  </div>
                </div>
                <button onClick={handleGenerateInvite} disabled={generating}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold
                    text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                  {generating ? "Generating…" : "Generate invite link"}
                </button>
                {generatedCode && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600
                      bg-white dark:bg-slate-900 px-3 py-2">
                      <span className="text-xs text-slate-400 dark:text-slate-400 font-mono flex-1 truncate">
                        {window.location.origin}/join/{generatedCode}
                      </span>
                      <button onClick={copyInviteLink}
                        className="flex items-center gap-1.5 text-xs text-blue-400
                          hover:text-blue-300 transition-colors shrink-0">
                        <CopyIcon/>
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-600">
                      Expires in {inviteExpiry} day{inviteExpiry > 1 ? "s" : ""}.
                    </p>
                  </div>
                )}
              </section>

              {/* Members list */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6
                flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Members</h2>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{members.length} total</span>
                </div>

                {owners.length > 0 && (
                  <RoleGroup label="Owner" members={owners} currentUserId={user!.id}
                    loading={actionId}/>
                )}
                {admins.length > 0 && (
                  <RoleGroup label="Admins" members={admins} currentUserId={user!.id}
                    loading={actionId}
                    isAdmin={isAdmin}
                    onDemote={isOwner ? handleDemote : undefined}
                    onRemove={isAdmin ? handleRemove : undefined}
                    onSetCapital={isAdmin ? (m) => setCapitalMember(m) : undefined}/>
                )}
                {traders.length > 0 && (
                  <RoleGroup label="Traders" members={traders} currentUserId={user!.id}
                    loading={actionId}
                    isAdmin={isAdmin}
                    onPromote={isAdmin ? handlePromote : undefined}
                    onRemove={isAdmin ? handleRemove : undefined}
                    onSetCapital={isAdmin ? (m) => setCapitalMember(m) : undefined}/>
                )}
                {members.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-4">
                    No members yet. Generate an invite link above.
                  </p>
                )}
              </section>

              {/* Danger zone */}
              {isOwner && (
                <section className="rounded-2xl border border-red-900/60 bg-red-950/20 p-6
                  flex flex-col gap-4">
                  <h2 className="text-sm font-semibold text-red-400">Danger Zone</h2>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">Delete organisation</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        All members become indie users. Trade history is preserved. Irreversible.
                      </p>
                    </div>
                    <button onClick={() => setShowDelete(true)}
                      className="shrink-0 rounded-xl border border-red-800 px-4 py-2
                        text-sm font-medium text-red-400 hover:bg-red-900/30 transition-colors">
                      Delete org
                    </button>
                  </div>
                </section>
              )}
            </>
          )}

          {/* ══════════════ GROUPS TAB ═══════════════════════ */}
          {tab === "groups" && (
            <>
              {/* Create group */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6
                flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Create Group</h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="e.g. Equity Desk, Derivatives Team…"
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreateGroup()}
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    onClick={handleCreateGroup}
                    disabled={creating || !newGroupName.trim()}
                    className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold
                      text-white hover:bg-blue-500 transition-colors disabled:opacity-40">
                    {creating ? "Creating…" : "Create"}
                  </button>
                </div>
              </section>

              {/* Groups list */}
              {groups.length > 0 && (
                <section className="flex flex-col gap-4">
                  {groups.map(group => {
                    // BUG FIX: filter locally instead of using stale group.member_count
                    const groupMembers = membersWithGroups.filter(m => m.group_id === group.id);
                    const isEditing    = editingGroup === group.id;
                    const isBusy       = actionId === group.id;

                    return (
                      <div key={group.id}
                        className={`rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6
                          flex flex-col gap-4 ${isBusy ? "opacity-60 pointer-events-none" : ""}`}>

                        {/* Group header */}
                        <div className="flex items-center justify-between gap-3">
                          {isEditing ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                value={editName}
                                onChange={e => setEditName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter")  handleRenameGroup(group.id);
                                  if (e.key === "Escape") setEditingGroup(null);
                                }}
                                autoFocus
                                className="text-base font-semibold bg-transparent border-b border-blue-500
                                  text-slate-900 dark:text-white focus:outline-none flex-1"
                              />
                              <button onClick={() => handleRenameGroup(group.id)}
                                className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-500">
                                Save
                              </button>
                              <button onClick={() => setEditingGroup(null)}
                                className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{group.name}</h3>
                              {/* Use local count, not RPC member_count */}
                              <span className="text-xs text-slate-400 dark:text-slate-600">
                                {groupMembers.length} member{groupMembers.length !== 1 ? "s" : ""}
                              </span>
                              <button
                                onClick={() => { setEditingGroup(group.id); setEditName(group.name); }}
                                className="p-1 rounded text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:text-slate-300
                                  hover:bg-slate-200 dark:bg-slate-700 transition-colors">
                                <PencilIcon/>
                              </button>
                            </div>
                          )}

                          <button
                            onClick={() => handleDeleteGroup(group.id, group.name)}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-600 hover:text-red-400
                              hover:bg-red-900/20 transition-colors shrink-0">
                            <TrashIcon/>
                          </button>
                        </div>

                        {/* Members in this group */}
                        {groupMembers.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {groupMembers.map(m => (
                              <GroupMemberRow
                                key={m.id}
                                member={m}
                                groups={groups}
                                currentGroupId={group.id}
                                busy={actionId === m.id}
                                onSetGroup={handleSetMemberGroup}
                              />
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-600 italic">No members assigned yet.</p>
                        )}

                        {/* Add unassigned members */}
                        {unassigned.length > 0 && (
                          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                            <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Add member to this group:</p>
                            <div className="flex flex-wrap gap-2">
                              {unassigned.map(m => (
                                <button
                                  key={m.id}
                                  onClick={() => handleSetMemberGroup(m.id, group.id)}
                                  disabled={!!actionId}
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg border
                                    border-slate-300 dark:border-slate-600 text-xs text-slate-400 dark:text-slate-400
                                    hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700
                                    transition-colors disabled:opacity-40">
                                  {m.avatar_url ? (
                                    <img src={m.avatar_url} alt="" className="w-4 h-4 rounded-full"/>
                                  ) : (
                                    <div className="w-4 h-4 rounded-full bg-slate-600 flex items-center
                                      justify-center text-xs font-bold text-slate-700 dark:text-slate-300">
                                      {(m.display_name ?? "?").charAt(0)}
                                    </div>
                                  )}
                                  {m.display_name ?? "Unknown"}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              )}

              {/* Unassigned */}
              {unassigned.length > 0 && groups.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Create a group above to start organising your {membersWithGroups.length} members.
                  </p>
                </div>
              )}

              {unassigned.length > 0 && groups.length > 0 && (
                <section className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-100/30 dark:bg-slate-800/30 p-6
                  flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-slate-400 dark:text-slate-400">
                    Unassigned ({unassigned.length})
                  </h2>
                  {unassigned.map(m => (
                    <GroupMemberRow
                      key={m.id}
                      member={m}
                      groups={groups}
                      currentGroupId={null}
                      busy={actionId === m.id}
                      onSetGroup={handleSetMemberGroup}
                    />
                  ))}
                </section>
              )}
            </>
          )}

        </div>
      </main>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function RoleGroup({ label, members, currentUserId, loading, isAdmin, onPromote, onDemote, onRemove, onSetCapital }: {
  label: string; members: OrgMember[]; currentUserId: string; loading: string | null;
  isAdmin?: boolean;
  onPromote?:    (id: string) => void;
  onDemote?:     (id: string) => void;
  onRemove?:     (id: string) => void;
  onSetCapital?: (member: OrgMember) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">{label}</p>
      {members.map(m => (
        <MemberRow key={m.id} member={m} currentUserId={currentUserId}
          isLoading={loading === m.id}
          onPromote={onPromote    ? () => onPromote(m.id)    : undefined}
          onDemote={onDemote      ? () => onDemote(m.id)     : undefined}
          onRemove={onRemove      ? () => onRemove(m.id)     : undefined}
          onSetCapital={onSetCapital ? () => onSetCapital(m) : undefined}
        />
      ))}
    </div>
  );
}

function MemberRow({ member, currentUserId, isLoading, onPromote, onDemote, onRemove, onSetCapital }: {
  member: OrgMember; currentUserId: string; isLoading: boolean;
  onPromote?:    () => void;
  onDemote?:     () => void;
  onRemove?:     () => void;
  onSetCapital?: () => void;
}) {
  const isCurrentUser = member.id === currentUserId;
  const initials = (member.display_name ?? "?").charAt(0).toUpperCase();

  function formatCapital(v: number) {
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000)   return `₹${(v / 1000).toFixed(0)}k`;
    return `₹${v}`;
  }

  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-xl
      transition-colors ${isLoading
        ? "opacity-40 pointer-events-none"
        : "hover:bg-slate-100/30 dark:bg-slate-700/30"}`}>
      <div className="flex items-center gap-3">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.display_name ?? ""}
            className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"/>
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center
            justify-center text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            {initials}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-800 dark:text-slate-200">{member.display_name ?? "Unknown"}</span>
            {isCurrentUser && <span className="text-xs text-slate-400 dark:text-slate-600">(you)</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded border
              ${ROLE_BADGE[member.org_role] ?? ROLE_BADGE.member}`}>
              {ROLE_LABELS[member.org_role] ?? member.org_role}
            </span>
            {/* Capital limit badge — tappable for admins */}
            {onSetCapital ? (
              <button onClick={onSetCapital}
                className="text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600
                  text-slate-400 dark:text-slate-500 hover:border-blue-500 hover:text-blue-400
                  transition-colors tabular-nums">
                {formatCapital(member.capital_limit ?? 100000)} ✎
              </button>
            ) : (
              <span className="text-xs text-slate-500 dark:text-slate-600 tabular-nums">
                {formatCapital(member.capital_limit ?? 100000)}
              </span>
            )}
          </div>
        </div>
      </div>
      {!isCurrentUser && (
        <div className="flex items-center gap-2">
          {onPromote && (
            <button onClick={onPromote}
              className="text-xs px-2 py-1 rounded-lg border border-amber-700
                text-amber-400 hover:bg-amber-900/20 transition-colors">
              Make admin
            </button>
          )}
          {onDemote && (
            <button onClick={onDemote}
              className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600
                text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200
                hover:bg-slate-200 dark:bg-slate-700 transition-colors">
              Remove admin
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove}
              className="text-xs px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600
                text-slate-400 dark:text-slate-400 hover:text-red-400 hover:border-red-800
                hover:bg-red-900/20 transition-colors">
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GroupMemberRow({
  member, groups, currentGroupId, busy, onSetGroup,
}: {
  member:         OrgMemberWithGroup;
  groups:         OrgGroup[];
  currentGroupId: string | null;
  busy:           boolean;
  onSetGroup:     (memberId: string, groupId: string | null) => void;
}) {
  const initials = (member.display_name ?? "?").charAt(0).toUpperCase();
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-xl
      hover:bg-slate-100/30 dark:bg-slate-700/30 transition-colors ${busy ? "opacity-40 pointer-events-none" : ""}`}>
      <div className="flex items-center gap-3">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.display_name ?? ""}
            className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600 shrink-0"/>
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center
            justify-center text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            {initials}
          </div>
        )}
        <span className="text-sm text-slate-800 dark:text-slate-200">{member.display_name ?? "Unknown"}</span>
        {member.org_role !== "member" && (
          <span className="text-xs px-1.5 py-0.5 rounded border border-amber-700
            text-amber-400 bg-amber-900/20 capitalize">
            {member.org_role}
          </span>
        )}
      </div>
      <select
        value={currentGroupId ?? "none"}
        onChange={e => onSetGroup(member.id, e.target.value === "none" ? null : e.target.value)}
        className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800
          text-slate-400 dark:text-slate-400 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer">
        <option value="none">No group</option>
        {groups.map(g => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </div>
  );
}