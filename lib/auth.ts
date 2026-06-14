// ============================================================
// lib/auth.ts
// Auth helpers built on Supabase Auth.
// Handles Google OAuth sign-in, session management,
// and linking anonymous trades to real accounts on first login.
// ============================================================

import { supabase } from "./supabase";

export interface AppUser {
  id:          string;   // trader_users.id (our DB row)
  authId:      string;   // auth.users.id (Supabase auth)
  email:       string;
  name:        string;
  avatarUrl:   string | null;
  role:        "user" | "admin";
}

/**
 * Sign in with Google — redirects to Google then back to /auth/callback
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options:  {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

/**
 * Get the current Supabase session (null if not logged in)
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Ensures a trader_users row exists for this auth user.
 * If an anonymous_id is passed (from localStorage), migrates
 * any trades saved anonymously to this real account.
 * Returns the AppUser.
 */
export async function ensureAuthUser(anonymousId?: string): Promise<AppUser | null> {
  const session = await getSession();
  if (!session?.user) return null;

  const authUser = session.user;
  const email    = authUser.email ?? "";
  const name     = authUser.user_metadata?.full_name ?? email;
  const avatar   = authUser.user_metadata?.avatar_url ?? null;

  // Check if trader_users row already exists for this auth user
  const { data: existing } = await supabase
    .from("trader_users")
    .select("id, role")
    .eq("auth_user_id", authUser.id)
    .single();

  if (existing) {
    // If there's an anonymous_id, migrate any orphaned trades
    if (anonymousId) await migrateAnonymousTrades(anonymousId, existing.id);
    return {
      id:        existing.id,
      authId:    authUser.id,
      email,
      name,
      avatarUrl: avatar,
      role:      existing.role as "user" | "admin",
    };
  }

  // First login — create trader_users row
  const { data: created, error } = await supabase
    .from("trader_users")
    .insert({
      anonymous_id:  authUser.id, // use auth id as anonymous_id for uniqueness
      auth_user_id:  authUser.id,
    })
    .select("id, role")
    .single();

  if (error || !created) throw new Error(`Failed to create user: ${error?.message}`);

  // Migrate anonymous trades if any
  if (anonymousId) await migrateAnonymousTrades(anonymousId, created.id);

  return {
    id:        created.id,
    authId:    authUser.id,
    email,
    name,
    avatarUrl: avatar,
    role:      created.role as "user" | "admin",
  };
}

/**
 * Migrates trades saved under anonymous_id to the real user's ID.
 * Called once on first login if localStorage has an anonymous_id.
 */
async function migrateAnonymousTrades(
  anonymousId: string,
  realUserId:  string
): Promise<void> {
  // Find the anonymous trader_users row
  const { data: anonUser } = await supabase
    .from("trader_users")
    .select("id")
    .eq("anonymous_id", anonymousId)
    .is("auth_user_id", null)  // only unlinked anonymous rows
    .single();

  if (!anonUser) return; // no anonymous trades to migrate

  // Re-assign all their trades to the real user
  await supabase
    .from("trades")
    .update({ user_id: realUserId })
    .eq("user_id", anonUser.id);

  // Delete the now-empty anonymous user row
  await supabase
    .from("trader_users")
    .delete()
    .eq("id", anonUser.id);

  // Clear localStorage so we don't try to migrate again
  try { localStorage.removeItem("trm_anonymous_id"); } catch {}
}