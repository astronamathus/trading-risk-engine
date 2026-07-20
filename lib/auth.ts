// ============================================================
// lib/auth.ts
// Auth helpers built on Supabase Auth.
// Changes vs original:
//   - ensureAuthUser now saves display_name + avatar_url on
//     trader_users so leaderboard can show real names/avatars
//     without needing the admin API
//   - orgId retained on AppUser for backwards-compat routing
//   - isSuperAdmin(user) helper — role === "admin" check in
//     one place so nothing hardcodes the string elsewhere
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
  orgId:       string | null;
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

  const authUser    = session.user;
  const email       = authUser.email ?? "";
  const name        = authUser.user_metadata?.full_name ?? email;
  const avatar      = authUser.user_metadata?.avatar_url ?? null;

  const { data: existing } = await supabase
    .from("trader_users")
    .select("id, role, user_type, org_id, currency")
    .eq("auth_user_id", authUser.id)
    .single();

  if (existing) {
    // Keep display_name / avatar_url fresh on every login
    await supabase
      .from("trader_users")
      .update({ display_name: name, avatar_url: avatar })
      .eq("id", existing.id);

    if (anonymousId) await migrateAnonymousTrades(anonymousId, existing.id);

    return {
      id:        existing.id,
      authId:    authUser.id,
      email,
      name,
      avatarUrl: avatar,
      role:      existing.role as "user" | "admin",
      userType:  existing.user_type as AppUser["userType"],
      orgId:     existing.org_id ?? null,
      currency:  (existing.currency as "INR" | "USD") ?? "INR",
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
    .select("id, role, user_type, org_id")
    .single();

  if (error || !created) throw new Error(`Failed to create user: ${error?.message}`);

  if (anonymousId) await migrateAnonymousTrades(anonymousId, created.id);

  return {
    id:        created.id,
    authId:    authUser.id,
    email,
    name,
    avatarUrl: avatar,
    role:      created.role as "user" | "admin",
    userType:  null,
    orgId:     null,
    currency:  "INR" as const,
  };
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