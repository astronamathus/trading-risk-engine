// ============================================================
// lib/db/org.ts
// ============================================================

import { supabase } from "../supabase";

export interface Organisation {
  id:         string;
  name:       string;
  slug:       string;
  domain:     string | null;
  created_at: string;
}

export interface OrgInvite {
  id:         string;
  org_id:     string;
  code:       string;
  role:       "member" | "admin";
  created_by: string;
  expires_at: string;
  max_uses:   number | null;
  use_count:  number;
  created_at: string;
}

export interface OrgMember {
  id:           string;
  display_name: string | null;
  avatar_url:   string | null;
  org_role:     "owner" | "admin" | "member";
  joined_at:    string;
}

// ── Org creation ─────────────────────────────────────────────

export async function createOrganisation(
  name:    string,
  _userId: string,
  domain?: string,
): Promise<Organisation> {
  const { data, error } = await supabase.rpc("create_org_with_owner", {
    p_name:   name,
    p_domain: domain ?? null,
  });
  if (error) throw new Error(`Failed to create org: ${error.message}`);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to create org");

  const { data: org, error: fetchErr } = await supabase
    .from("organisations")
    .select("*")
    .eq("id", data.org_id)
    .single();

  if (fetchErr || !org) throw new Error("Org created but could not fetch details");
  return org as Organisation;
}

// ── Indie user ───────────────────────────────────────────────

export async function setIndieUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("trader_users")
    .update({ user_type: "indie" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

// ── Invites ──────────────────────────────────────────────────

export async function createInvite(
  orgId:         string,
  createdBy:     string,
  role:          "member" | "admin" = "member",
  maxUses:       number | null = null,
  expiresInDays: number = 7,
): Promise<OrgInvite> {
  const code      = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresAt = new Date(
    Date.now() + expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from("org_invites")
    .insert({ org_id: orgId, code, role, created_by: createdBy, expires_at: expiresAt, max_uses: maxUses })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to create invite: ${error?.message}`);
  return data as OrgInvite;
}

export async function getInviteByCode(
  code: string
): Promise<(OrgInvite & { org: Organisation }) | null> {
  const { data, error } = await supabase
    .from("org_invites")
    .select("*, org:organisations(*)")
    .eq("code", code)
    .single();

  if (error || !data) return null;
  if (new Date(data.expires_at) < new Date()) return null;
  if (data.max_uses !== null && data.use_count >= data.max_uses) return null;

  return data as OrgInvite & { org: Organisation };
}

export async function acceptInvite(code: string, _userId: string): Promise<void> {
  const { data, error } = await supabase.rpc("validate_and_accept_invite", {
    p_code: code,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to join organisation");
}

// ── Members ──────────────────────────────────────────────────

export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase.rpc("get_org_members_with_profiles", {
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to fetch members");
  return (data.members ?? []) as OrgMember[];
}

export async function promoteMember(
  memberId: string,
  orgId:    string,
  newRole:  "admin" | "member" = "admin",
): Promise<void> {
  const { data, error } = await supabase.rpc("promote_member", {
    p_member_id: memberId,
    p_org_id:    orgId,
    p_new_role:  newRole,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to promote member");
}

export async function removeMember(memberId: string, orgId: string): Promise<void> {
  const { data, error } = await supabase.rpc("remove_member", {
    p_member_id: memberId,
    p_org_id:    orgId,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to remove member");
}

// ── Org lookup ───────────────────────────────────────────────

export async function getUserOrg(userId: string): Promise<Organisation | null> {
  // Try membership table first (source of truth after migration)
  const { data: membership } = await supabase
    .from("org_memberships")
    .select("org_id, organisations(*)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .single();

  if (membership?.organisations) {
    return membership.organisations as unknown as Organisation;
  }

  // Fallback: legacy org_id column
  const { data: user } = await supabase
    .from("trader_users")
    .select("org_id")
    .eq("id", userId)
    .single();

  if (!user?.org_id) return null;

  const { data: org } = await supabase
    .from("organisations")
    .select("*")
    .eq("id", user.org_id)
    .single();

  return (org as Organisation) ?? null;
}

// ── Admin trade actions ───────────────────────────────────────

export async function adminSoftDeleteTrade(
  tradeId: string,
  orgId:   string,
  reason:  string,
): Promise<void> {
  const { data, error } = await supabase.rpc("admin_soft_delete_trade", {
    p_trade_id: tradeId,
    p_org_id:   orgId,
    p_reason:   reason,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to delete trade");
}

// ── Org management ────────────────────────────────────────────

export async function renameOrganisation(orgId: string, newName: string): Promise<void> {
  const { data, error } = await supabase.rpc("rename_organisation", {
    p_org_id:    orgId,
    p_new_name:  newName,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to rename organisation");
}

export async function deleteOrganisation(orgId: string): Promise<void> {
  const { data, error } = await supabase.rpc("delete_organisation", {
    p_org_id: orgId,
  });
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? "Failed to delete organisation");
}