"use client";

// ============================================================
// app/auth/callback/page.tsx
// Handles the OAuth redirect from Supabase/Google.
// Supabase returns the session as a URL fragment (#access_token=...)
// which only the browser can read — so this must be a client page,
// not a server route.ts.
// ============================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase }  from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Supabase client automatically reads the #access_token fragment
    // and sets the session when getSession() is called.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (session) {
        // Session established — go to dashboard
        router.replace("/dashboard");
      } else {
        // No session — back to auth with error
        console.error("Auth callback error:", error);
        router.replace("/auth?error=oauth_failed");
      }
    });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center gap-3 text-slate-500">
      <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <span className="text-sm">Completing sign in…</span>
    </div>
  );
}