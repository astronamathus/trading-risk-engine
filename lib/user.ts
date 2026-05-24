// ============================================================
// lib/user.ts
// Anonymous user system — no sign-in required.
//
// How it works:
//   1. On first visit, generate a UUID and store in localStorage
//   2. On every visit, read that UUID
//   3. Upsert a row in the `users` table with that UUID
//
// This gives each browser a stable identity that persists
// across sessions without any authentication.
// ============================================================

import { supabase } from "./supabase";

const STORAGE_KEY = "trm_anonymous_id"; // trm = trade risk manager

/**
 * Gets or creates a stable anonymous ID for this browser.
 * Must only be called client-side (localStorage is browser-only).
 */
export function getAnonymousId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/**
 * Ensures a user row exists in Supabase for this anonymous ID.
 * Uses upsert so it's safe to call on every page load.
 * Returns the user's UUID (different from the anonymous_id).
 */
export async function ensureUser(anonymousId: string): Promise<string> {
  // Try to find existing user first
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("anonymous_id", anonymousId)
    .single();

  if (existing?.id) return existing.id;

  // Not found — create new user
  const { data: created, error } = await supabase
    .from("users")
    .insert({ anonymous_id: anonymousId })
    .select("id")
    .single();

  if (error || !created?.id) {
    throw new Error(`Failed to create user: ${error?.message}`);
  }

  return created.id;
}