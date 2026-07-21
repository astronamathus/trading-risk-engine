// ============================================================
// lib/auth.ts
// Auth helpers built on Supabase Auth.
// Changes:
//   - ensureAuthUser saves display_name + avatar_url on every login
//   - orgId retained for backwards-compat routing
//   - activeOrgId: which org the super admin is currently acting as
//   - orgIds: all orgs the user is a member of (multi-org support)
//   - isSuperAdmin(user) helper — single source of truth
// ============================================================

import { supabase } from "./supabase";

export interface AppUser {
  id:          string;
  authId:      string;
  email:       string;
  name:        string;
  avatarUrl:   string | null;
  role:        "user" | "admin";
  userType:    "indie" | "org_member" | "org_admin" | null;
  orgId:       string | null;   // active org (legacy compat + active_org_id)
  activeOrgId: string | null;   // explicit switcher selection
  orgIds:      string[];        // all orgs this user owns/belongs to
  currency:    "INR" | "USD";
}

/** True when the user has platform-level super admin access. */
export function isSuperAdmin(user: AppUser | null): boolean {
  return user?.role === "admin";
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options:  { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function ensureAuthUser(anonymousId?: string): Promise<AppUser | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const authUser = session.user;
  const email    = authUser.email ?? "";
  const name     = authUser.user_metadata?.full_name ?? email;
  const avatar   = authUser.user_metadata?.avatar_url ?? null;

  const { data: existing } = await supabase
    .from("trader_users")
    .select("id, role, user_type, org_id, active_org_id, currency")
    .eq("auth_user_id", authUser.id)
    .single();

  if (existing) {
    // Keep display_name / avatar_url fresh on every login
    await supabase
      .from("trader_users")
      .update({ display_name: name, avatar_url: avatar })
      .eq("id", existing.id);

    if (anonymousId) await migrateAnonymousTrades(anonymousId, existing.id);

    // Fetch all org memberships
    const orgIds = await fetchOrgIds(existing.id);

    // activeOrgId: prefer explicit selection, else first membership
    const activeOrgId = existing.active_org_id ?? orgIds[0] ?? null;

    return {
      id:          existing.id,
      authId:      authUser.id,
      email,
      name,
      avatarUrl:   avatar,
      role:        existing.role as "user" | "admin",
      userType:    existing.user_type as AppUser["userType"],
      orgId:       activeOrgId,
      activeOrgId: existing.active_org_id ?? null,
      orgIds,
      currency:    (existing.currency as "INR" | "USD") ?? "INR",
    };
  }

  // First login — create trader_users row
  const { data: created, error } = await supabase
    .from("trader_users")
    .insert({
      anonymous_id: authUser.id,
      auth_user_id: authUser.id,
      display_name: name,
      avatar_url:   avatar,
      user_type:    null,
    })
    .select("id, role, user_type, org_id, active_org_id")
    .single();

  if (error || !created) throw new Error(`Failed to create user: ${error?.message}`);

  if (anonymousId) await migrateAnonymousTrades(anonymousId, created.id);

  return {
    id:          created.id,
    authId:      authUser.id,
    email,
    name,
    avatarUrl:   avatar,
    role:        created.role as "user" | "admin",
    userType:    null,
    orgId:       null,
    activeOrgId: null,
    orgIds:      [],
    currency:    "INR" as const,
  };
}

async function fetchOrgIds(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  return (data ?? []).map((r: { org_id: string }) => r.org_id);
}

async function migrateAnonymousTrades(anonymousId: string, realUserId: string): Promise<void> {
  const { data: anonUser } = await supabase
    .from("trader_users")
    .select("id")
    .eq("anonymous_id", anonymousId)
    .is("auth_user_id", null)
    .single();

  if (!anonUser) return;

  await supabase.from("trades").update({ user_id: realUserId }).eq("user_id", anonUser.id);
  await supabase.from("trader_users").delete().eq("id", anonUser.id);

  try { localStorage.removeItem("trm_anonymous_id"); } catch {}
}