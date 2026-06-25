"use client";

// ============================================================
// app/org/settings/page.tsx
// Org admin settings: invite generation + member management.
//
// Changes vs original:
//   - getOrgMembers now returns display_name/avatar_url from
//     trader_users (no admin API, no "—" fallbacks)
//   - promoteMember/removeMember now pass orgId to call RPCs
//   - Supports owner/admin/member roles from org_memberships
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter }   from "next/navigation";
import { useAuth }     from "@/components/AuthProvider";
import {
  getUserOrg, getOrgMembers, createInvite,
  promoteMember, removeMember,
} from "@/lib/db/org";
import type { Organisation, OrgMember, OrgInvite } from "@/lib/db/org";

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 " +
  "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5"/>
      <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>
    </svg>
  );
}

const ROLE_LABELS: Record<string, string> = {
  owner:  "Owner",
  admin:  "Admin",
  member: "Trader",
};

const ROLE_BADGE: Record<string, string> = {
  owner:  "border-purple-700 text-purple-400 bg-purple-900/20",
  admin:  "border-amber-700  text-amber-400  bg-amber-900/20",
  member: "border-slate-600  text-slate-400  bg-slate-800/40",
};

export default function OrgSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [org,     setOrg]     = useState<Organisation | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  // Invite state
  const [inviteRole,    setInviteRole]    = useState<"member" | "admin">("member");
  const [inviteExpiry,  setInviteExpiry]  = useState(7);
  const [inviteMaxUses, setInviteMaxUses] = useState<number | "unlimited">(1);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating,    setGenerating]    = useState(false);
  const [copied,        setCopied]        = useState(false);

  // Per-row action state
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const orgData = await getUserOrg(user.id);
      if (!orgData) { router.replace("/onboarding"); return; }
      setOrg(orgData);

      // Only admins/owners can view members (RPC enforces this)
      if (user.userType === "org_admin") {
        const memberData = await getOrgMembers(orgData.id);
        setMembers(memberData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!user)                      { router.replace("/auth");       return; }
    if (user.userType !== "org_admin") { router.replace("/dashboard"); return; }
    load();
  }, [user, authLoading, load]);

  async function handleGenerateInvite() {
    if (!user || !org) return;
    setGenerating(true);
    setGeneratedCode(null);
    setError(null);
    try {
      const invite = await createInvite(
        org.id,
        user.id,
        inviteRole,
        inviteMaxUses === "unlimited" ? null : inviteMaxUses,
        inviteExpiry,
      );
      setGeneratedCode(invite.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invite.");
    } finally {
      setGenerating(false);
    }
  }

  function copyInviteLink() {
    if (!generatedCode) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${generatedCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handlePromote(memberId: string) {
    if (!org) return;
    setActionId(memberId);
    try {
      await promoteMember(memberId, org.id, "admin");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to promote member.");
    } finally {
      setActionId(null);
    }
  }

  async function handleRemove(memberId: string) {
    if (!org) return;
    if (!confirm("Remove this member from the organisation?")) return;
    setActionId(memberId);
    try {
      await removeMember(memberId, org.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member.");
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

  const owners  = members.filter(m => m.org_role === "owner");
  const admins  = members.filter(m => m.org_role === "admin");
  const traders = members.filter(m => m.org_role === "member");

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">{org?.name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">Organisation settings</p>
          </div>
          <span className="text-xs px-2 py-1 rounded-full border border-amber-700
            text-amber-400 bg-amber-900/20">
            Admin
          </span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">{error}</div>
        )}

        {/* Invite generation */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
          flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-slate-200">Generate Invite Link</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as "member" | "admin")}
                className={inputClass}
              >
                <option value="member">Member (trader)</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Expires in</label>
              <select
                value={inviteExpiry}
                onChange={e => setInviteExpiry(Number(e.target.value))}
                className={inputClass}
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-500 uppercase tracking-wider">Max uses</label>
              <select
                value={inviteMaxUses}
                onChange={e => setInviteMaxUses(
                  e.target.value === "unlimited" ? "unlimited" : Number(e.target.value)
                )}
                className={inputClass}
              >
                <option value={1}>1 (single use)</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value="unlimited">Unlimited</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerateInvite}
            disabled={generating}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-blue-500 transition-colors disabled:opacity-50
              focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {generating ? "Generating…" : "Generate invite link"}
          </button>

          {generatedCode && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-600
                bg-slate-900 px-3 py-2">
                <span className="text-xs text-slate-400 font-mono flex-1 truncate">
                  {window.location.origin}/join/{generatedCode}
                </span>
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1.5 text-xs text-blue-400
                    hover:text-blue-300 transition-colors shrink-0"
                >
                  <CopyIcon/>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-slate-600">
                Expires in {inviteExpiry} day{inviteExpiry > 1 ? "s" : ""}.
              </p>
            </div>
          )}
        </section>

        {/* Members */}
        <section className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
          flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Members</h2>
            <span className="text-xs text-slate-500">{members.length} total</span>
          </div>

          {owners.length > 0 && (
            <RoleGroup label="Owner" members={owners} currentUserId={user!.id}
              loading={actionId} />
          )}
          {admins.length > 0 && (
            <RoleGroup label="Admins" members={admins} currentUserId={user!.id}
              loading={actionId} onRemove={handleRemove} />
          )}
          {traders.length > 0 && (
            <RoleGroup label="Traders" members={traders} currentUserId={user!.id}
              loading={actionId} onPromote={handlePromote} onRemove={handleRemove} />
          )}

          {members.length === 0 && (
            <p className="text-sm text-slate-600 text-center py-4">
              No members yet. Generate an invite link above.
            </p>
          )}
        </section>

      </div>
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────

function RoleGroup({
  label, members, currentUserId, loading, onPromote, onRemove,
}: {
  label:         string;
  members:       OrgMember[];
  currentUserId: string;
  loading:       string | null;
  onPromote?:    (id: string) => void;
  onRemove?:     (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">{label}</p>
      {members.map(m => (
        <MemberRow
          key={m.id}
          member={m}
          currentUserId={currentUserId}
          isLoading={loading === m.id}
          onPromote={onPromote ? () => onPromote(m.id) : undefined}
          onRemove={onRemove  ? () => onRemove(m.id)  : undefined}
        />
      ))}
    </div>
  );
}

function MemberRow({
  member, currentUserId, isLoading, onPromote, onRemove,
}: {
  member:        OrgMember;
  currentUserId: string;
  isLoading:     boolean;
  onPromote?:    () => void;
  onRemove?:     () => void;
}) {
  const isCurrentUser = member.id === currentUserId;
  const initials      = (member.display_name ?? "?").charAt(0).toUpperCase();

  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-xl
      transition-colors ${isLoading ? "opacity-40 pointer-events-none" : "hover:bg-slate-700/30"}`}>
      <div className="flex items-center gap-3">
        {member.avatar_url ? (
          <img src={member.avatar_url} alt={member.display_name ?? ""}
            className="w-7 h-7 rounded-full border border-slate-600 shrink-0"/>
        ) : (
          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center
            justify-center text-xs font-bold text-slate-300 shrink-0">
            {initials}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-200">
              {member.display_name ?? "Unknown"}
            </span>
            {isCurrentUser && <span className="text-xs text-slate-600">(you)</span>}
          </div>
          <span className={`text-xs px-1.5 py-0.5 rounded border
            ${ROLE_BADGE[member.org_role] ?? ROLE_BADGE.member}`}>
            {ROLE_LABELS[member.org_role] ?? member.org_role}
          </span>
        </div>
      </div>

      {!isCurrentUser && (
        <div className="flex items-center gap-2">
          {onPromote && (
            <button
              onClick={onPromote}
              className="text-xs px-2 py-1 rounded-lg border border-amber-700
                text-amber-400 hover:bg-amber-900/20 transition-colors"
            >
              Make admin
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-xs px-2 py-1 rounded-lg border border-slate-600
                text-slate-400 hover:text-red-400 hover:border-red-800
                hover:bg-red-900/20 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}