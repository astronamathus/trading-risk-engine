// ============================================================
// lib/supabase.ts
// Single shared Supabase client for the whole app.
// Uses NEXT_PUBLIC_ vars so it works on both client and server.
// ============================================================

import { createClient } from "@supabase/supabase-js";

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase env vars. Check .env.local");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    flowType:          "pkce",
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
  },
});
