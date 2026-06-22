// ============================================================
// lib/db/org.ts
// All database operations for organisations and invites.
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
  id:         string;
  email:      string;
  name:       string;
  avatar_url: string | null;
  org_role:   "admin" | "member";
  user_type:  string;
  created_at: string;
}

/**
 * Creates a new organisation and sets the current user as admin.
 */
export async function createOrganisation(
  name:      string,
  userId:    string,
  domain?:   string,
): Promise<Organisation> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const { data: org, error: orgError } = await supabase
    .from("organisations")
    .insert({ name, slug: `${slug}-${Date.now()}`, domain: domain ?? null })
    .select()
    .single();

  if (orgError || !org) throw new Error(`Failed to create org: ${orgError?.message}`);

  // Set user as org admin
  const { error: userError } = await supabase
    .from("trader_users")
    .update({ org_id: org.id, org_role: "admin", user_type: "org_admin" })
    .eq("id", userId);

  if (userError) throw new Error(`Failed to set admin: ${userError.message}`);

  return org as Organisation;
}

/**
 * Sets user_type to 'indie' for a user who chose solo trading.
 */
export async function setIndieUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from("trader_users")
    .update({ user_type: "indie" })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Generates an invite code for an organisation.
 * role: 'member' for traders, 'admin' for co-admins.
 * maxUses: null = unlimited, 1 = single use.
 * expiresInDays: how long the code is valid.
 */
export async function createInvite(
  orgId:          string,
  createdBy:      string,
  role:           "member" | "admin" = "member",
  maxUses:        number | null = null,
  expiresInDays:  number = 7,
): Promise<OrgInvite> {
  const code      = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("org_invites")
    .insert({ org_id: orgId, code, role, created_by: createdBy, expires_at: expiresAt, max_uses: maxUses })
    .select()
    .single();

  if (error || !data) throw new Error(`Failed to create invite: ${error?.message}`);
  return data as OrgInvite;
}

/**
 * Looks up a valid invite by code.
 * Returns null if not found, expired, or over max uses.
 */
export async function getInviteByCode(code: string): Promise<(OrgInvite & { org: Organisation }) | null> {
  const { data, error } = await supabase
    .from("org_invites")
    .select("*, org:organisations(*)")
    .eq("code", code)
    .single();

  if (error || !data) return null;

  // Validate
  if (new Date(data.expires_at) < new Date()) return null;
  if (data.max_uses !== null && data.use_count >= data.max_uses) return null;

  return data as OrgInvite & { org: Organisation };
}

/**
 * Accepts an invite — joins the user to the org and increments use_count.
 */
export async function acceptInvite(
  code:   string,
  userId: string,
): Promise<void> {
  const invite = await getInviteByCode(code);
  if (!invite) throw new Error("Invite is invalid or has expired.");

  const userType = invite.role === "admin" ? "org_admin" : "org_member";

  const { error: userError } = await supabase
    .from("trader_users")
    .update({ org_id: invite.org_id, org_role: invite.role, user_type: userType })
    .eq("id", userId);

  if (userError) throw new Error(`Failed to join org: ${userError.message}`);

  await supabase
    .from("org_invites")
    .update({ use_count: invite.use_count + 1 })
    .eq("code", code);
}

/**
 * Fetches all members of an organisation.
 */
export async function getOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from("trader_users")
    .select("id, org_role, user_type, created_at, auth_user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  // Enrich with auth user metadata
  const members = await Promise.all((data ?? []).map(async m => {
    const { data: authData } = await supabase.auth.admin?.getUserById?.(m.auth_user_id) ?? {};
    return {
      id:         m.id,
      email:      authData?.user?.email ?? "—",
      name:       authData?.user?.user_metadata?.full_name ?? "—",
      avatar_url: authData?.user?.user_metadata?.avatar_url ?? null,
      org_role:   m.org_role,
      user_type:  m.user_type,
      created_at: m.created_at,
    };
  }));

  return members as OrgMember[];
}

/**
 * Promotes a member to admin within an org.
 */
export async function promoteMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("trader_users")
    .update({ org_role: "admin", user_type: "org_admin" })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}

/**
 * Removes a member from an org (resets to indie).
 */
export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase
    .from("trader_users")
    .update({ org_id: null, org_role: null, user_type: "indie" })
    .eq("id", memberId);
  if (error) throw new Error(error.message);
}

/**
 * Gets the organisation for the current user.
 */
export async function getUserOrg(userId: string): Promise<Organisation | null> {
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

  return org as Organisation ?? null;
}