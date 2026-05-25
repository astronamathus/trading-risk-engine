// ============================================================
// lib/user.ts
// Anonymous user system — no sign-in required.
//
// Note: table is named "trader_users" (not "users") to avoid
// collision with Supabase's built-in auth.users table.
// ============================================================

import { supabase } from "./supabase";

const STORAGE_KEY = "trm_anonymous_id";

export function getAnonymousId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export async function ensureUser(anonymousId: string): Promise<string> {
  // Try to find existing user
  const { data: existing } = await supabase
    .from("trader_users")       // ← renamed from "users"
    .select("id")
    .eq("anonymous_id", anonymousId)
    .single();

  if (existing?.id) return existing.id;

  // Not found — create new
  const { data: created, error } = await supabase
    .from("trader_users")       // ← renamed from "users"
    .insert({ anonymous_id: anonymousId })
    .select("id")
    .single();

  if (error || !created?.id) {
    throw new Error(`Failed to create user: ${error?.message}`);
  }

  return created.id;
}