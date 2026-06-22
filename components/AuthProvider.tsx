"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase }        from "@/lib/supabase";
import { ensureAuthUser, AppUser } from "@/lib/auth";

interface AuthContextValue {
  user:    AppUser | null;
  loading: boolean;
  refresh: () => Promise<void>; // re-fetch user (e.g. after onboarding)
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true, refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// Pages that don't need auth or onboarding checks
const PUBLIC_PATHS  = ["/auth", "/auth/callback"];
const ONBOARD_PATH  = "/onboarding";
const ORG_PATHS     = ["/org/setup", "/join"];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router   = useRouter();

  async function loadUser() {
    try {
      const anonymousId = typeof window !== "undefined"
        ? localStorage.getItem("trm_anonymous_id") ?? undefined
        : undefined;
      const appUser = await ensureAuthUser(anonymousId);
      setUser(appUser);
      return appUser;
    } catch (err) {
      console.error("Auth load error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_IN") {
          const appUser = await loadUser();
          // After sign-in, redirect based on onboarding state
          if (appUser && appUser.userType === null) {
            router.push(ONBOARD_PATH);
          }
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
          router.push("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: redirect to onboarding if user_type is not set
  useEffect(() => {
    if (loading) return;
    if (!user) return;

    const isPublic   = PUBLIC_PATHS.some(p => pathname.startsWith(p));
    const isOrgPath  = ORG_PATHS.some(p => pathname.startsWith(p));
    const isOnboard  = pathname === ONBOARD_PATH;

    if (isPublic || isOrgPath || isOnboard) return;

    if (user.userType === null) {
      router.push(ONBOARD_PATH);
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh: async () => { await loadUser(); } }}>
      {children}
    </AuthContext.Provider>
  );
}