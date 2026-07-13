"use client";

// ============================================================
// app/org/groups/page.tsx
// Admins create/rename/delete groups and assign members.
// One member can only belong to one group per org.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { useRouter }  from "next/navigation";
import { useAuth }    from "@/components/AuthProvider";
import { getUserOrg } from "@/lib/db/org";
import { supabase }   from "@/lib/supabase";

interface OrgGroup {
  id:           string;
  name:         string;
  member_count: number;
  is_my_group:  boolean;
}

interface OrgMember {
  id:           string;
  display_name: string | null;
  avatar_url:   string | null;
  org_role:     string;
  group_id:     string | null;
  group_name:   string | null;
}

const inputClass =
  "rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 " +
  "placeholder:text-slate-400 dark:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

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

export default function GroupsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [orgId,    setOrgId]    = useState<string | null>(null);
  const [orgName,  setOrgName]  = useState("");
  const [groups,   setGroups]   = useState<OrgGroup[]>([]);
  const [members,  setMembers]  = useState<OrgMember[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // New group form
  const [newGroupName, setNewGroupName] = useState("");
  const [creating,     setCreating]     = useState(false);

  // Inline rename
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editName,     setEditName]     = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const org = await getUserOrg(user.id);
      if (!org) { router.replace("/onboarding"); return; }
      setOrgId(org.id);
      setOrgName(org.name);

      // Fetch groups
      const { data: gData } = await supabase.rpc("get_org_groups", { p_org_id: org.id });
      if (gData?.ok) setGroups(gData.groups ?? []);

      // Fetch all members with their current group assignment
      const { data: mData } = await supabase
        .from("org_memberships")
        .select("user_id, org_role, trader_users(id, display_name, avatar_url)")
        .eq("org_id", org.id);

      const { data: gmData } = await supabase
        .from("org_group_members")
        .select("user_id, group_id, org_groups(name)")
        .eq("org_id", org.id);

      const groupMap: Record<string, { group_id: string; group_name: string }> = {};
      (gmData ?? []).forEach((gm: any) => {
        groupMap[gm.user_id] = {
          group_id:   gm.group_id,
          group_name: gm.org_groups?.name ?? "",
        };
      });

      const enriched: OrgMember[] = (mData ?? []).map((m: any) => {
        const tu = Array.isArray(m.trader_users) ? m.trader_users[0] : m.trader_users;
        const gm = groupMap[m.user_id];
        return {
          id:           m.user_id,
          display_name: tu?.display_name ?? null,
          avatar_url:   tu?.avatar_url   ?? null,
          org_role:     m.org_role,
          group_id:     gm?.group_id    ?? null,
          group_name:   gm?.group_name  ?? null,
        };
      });

      setMembers(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
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

  async function handleCreateGroup() {
    if (!orgId || !newGroupName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { data } = await supabase.rpc("create_group", {
        p_org_id: orgId,
        p_name:   newGroupName.trim(),
      });
      if (!data?.ok) throw new Error(data?.error ?? "Failed to create group");
      setNewGroupName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRenameGroup(groupId: string) {
    if (!editName.trim()) { setEditingGroup(null); return; }
    setActionId(groupId);
    try {
      const { data } = await supabase.rpc("rename_group", {
        p_group_id: groupId, p_new_name: editName.trim(),
      });
      if (!data?.ok) throw new Error(data?.error ?? "Failed to rename");
      setEditingGroup(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename group.");
    } finally {
      setActionId(null);
    }
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    if (!confirm(`Delete group "${groupName}"? Members will be unassigned.`)) return;
    setActionId(groupId);
    try {
      const { data } = await supabase.rpc("delete_group", { p_group_id: groupId });
      if (!data?.ok) throw new Error(data?.error ?? "Failed to delete");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete group.");
    } finally {
      setActionId(null);
    }
  }

  async function handleSetMemberGroup(memberId: string, groupId: string | null) {
    setActionId(memberId);
    try {
      if (groupId) {
        const { data } = await supabase.rpc("set_group_member", {
          p_group_id: groupId, p_member_id: memberId,
        });
        if (!data?.ok) throw new Error(data?.error ?? "Failed to assign");
      } else {
        // Find current group and remove
        const member = members.find(m => m.id === memberId);
        if (member?.group_id) {
          const { data } = await supabase.rpc("remove_group_member", {
            p_group_id: member.group_id, p_member_id: memberId,
          });
          if (!data?.ok) throw new Error(data?.error ?? "Failed to remove");
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member group.");
    } finally {
      setActionId(null);
    }
  }

  if (loading || authLoading) return (
    <main className="flex items-center justify-center min-h-[60vh] gap-3 text-slate-400 dark:text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Loading groups…</span>
    </main>
  );

  // Group members grouped by group
  const unassigned = members.filter(m => !m.group_id);

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Groups</h1>
            <p className="text-sm text-slate-400 dark:text-slate-400 mt-0.5">{orgName}</p>
          </div>
          <button onClick={() => router.push("/org/settings")}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-xs
              text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:bg-slate-700 transition-colors">
            Settings
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">{error}</div>
        )}

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
                text-slate-900 dark:text-white hover:bg-blue-500 transition-colors disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </section>

        {/* Groups list */}
        {groups.length > 0 && (
          <section className="flex flex-col gap-4">
            {groups.map(group => {
              const groupMembers = members.filter(m => m.group_id === group.id);
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
                          className="text-xs px-2 py-1 rounded-lg bg-blue-600 text-slate-900 dark:text-white hover:bg-blue-500">
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
                        <span className="text-xs text-slate-400 dark:text-slate-600">
                          {group.member_count} member{group.member_count !== 1 ? "s" : ""}
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
                        <MemberRow
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

                  {/* Add unassigned members to this group */}
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
                              border-slate-300 dark:border-slate-600 text-xs text-slate-400 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200
                              hover:bg-slate-200 dark:bg-slate-700 transition-colors disabled:opacity-40"
                          >
                            {m.avatar_url ? (
                              <img src={m.avatar_url} alt=""
                                className="w-4 h-4 rounded-full"/>
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

        {/* Unassigned members */}
        {unassigned.length > 0 && groups.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              Create a group above to start organising your {members.length} members.
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
              <MemberRow
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

      </div>
    </main>
  );
}

function MemberRow({
  member, groups, currentGroupId, busy, onSetGroup,
}: {
  member:         OrgMember;
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

      {/* Group selector */}
      <select
        value={currentGroupId ?? "none"}
        onChange={e => onSetGroup(member.id, e.target.value === "none" ? null : e.target.value)}
        className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-400
          px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
      >
        <option value="none">No group</option>
        {groups.map(g => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </div>
  );
}