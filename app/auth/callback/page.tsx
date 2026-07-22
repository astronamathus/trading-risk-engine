"use client";

// ============================================================
// app/auth/callback/page.tsx
// Handles the OAuth redirect from Supabase/Google.
// Supabase PKCE redirects back with a ?code=... value.
// Exchange it in the browser so the Supabase client can persist the session.
// ============================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase }  from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function finishSignIn() {
      const code = new URLSearchParams(window.location.search).get("code");

      const { data: { session }, error } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.getSession();

      if (error || !session) {
        console.error("Auth callback error:", error);
        router.replace("/auth?error=oauth_failed");
        return;
      }

      router.replace("/dashboard");
    }

    void finishSignIn();
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