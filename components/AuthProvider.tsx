// ============================================================
// components/AuthProvider.tsx
// Provides auth state to the whole app via React context.
// Wraps layout.tsx so every page can access the current user.
// ============================================================

"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureAuthUser, AppUser } from "@/lib/auth";

interface AuthContextValue {
  user:    AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load user on mount
    async function loadUser() {
      try {
        const anonymousId = localStorage.getItem("trm_anonymous_id") ?? undefined;
        const appUser     = await ensureAuthUser(anonymousId);
        setUser(appUser);
      } catch (err) {
        console.error("Auth load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadUser();

    // Listen for auth state changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_IN") {
          const anonymousId = localStorage.getItem("trm_anonymous_id") ?? undefined;
          const appUser     = await ensureAuthUser(anonymousId);
          setUser(appUser);
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}