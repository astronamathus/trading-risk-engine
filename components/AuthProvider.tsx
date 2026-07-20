"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase }               from "@/lib/supabase";
import { ensureAuthUser, isSuperAdmin as checkSuperAdmin, AppUser } from "@/lib/auth";

interface AuthContextValue {
  user:         AppUser | null;
  loading:      boolean;
  refresh:      () => Promise<void>;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true, refresh: async () => {}, isSuperAdmin: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/auth", "/auth/callback"];
const ONBOARD_PATH = "/onboarding";

// Paths reachable during / immediately after onboarding
// before userType is set — guard must not redirect these.
const ONBOARDING_FLOW_PATHS = [
  "/onboarding",
  "/org/new",      // create org (was /org/setup — missing from original list)
  "/org/setup",    // keep for backwards compat
  "/join",         // invite acceptance
  "/super",        // super admin — has its own layout-level role guard
];

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

  useEffect(() => {
    if (loading) return;
    if (!user)   return;

    const isPublic       = PUBLIC_PATHS.some(p => pathname.startsWith(p));
    const isOnboardFlow  = ONBOARDING_FLOW_PATHS.some(p => pathname.startsWith(p));

    if (isPublic || isOnboardFlow) return;

    if (user.userType === null) {
      router.push(ONBOARD_PATH);
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh: async () => { await loadUser(); }, isSuperAdmin: checkSuperAdmin(user) }}>
      {children}
    </AuthContext.Provider>
  );
}