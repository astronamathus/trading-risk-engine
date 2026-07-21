"use client";

// ============================================================
// components/AuthProvider.tsx
// Changes:
//   - isSuperAdmin exposed from context
//   - activeOrgId + orgIds exposed for multi-org switching
//   - setActiveOrg: switches org server-side + refreshes user
//   - Super admins with userType === null bypass onboarding
//     and go to /super instead (they get role='admin' from the
//     trigger before userType is set on first org creation)
// ============================================================

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ensureAuthUser, isSuperAdmin as checkSuperAdmin, AppUser } from "@/lib/auth";
import { setActiveOrg as setActiveOrgRpc } from "@/lib/db/org";

interface AuthContextValue {
  user:         AppUser | null;
  loading:      boolean;
  refresh:      () => Promise<void>;
  isSuperAdmin: boolean;
  activeOrgId:  string | null;
  orgIds:       string[];
  setActiveOrg: (orgId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true, refresh: async () => {},
  isSuperAdmin: false, activeOrgId: null, orgIds: [],
  setActiveOrg: async () => {},
});

export function useAuth() { return useContext(AuthContext); }

const ONBOARD_PATH = "/onboarding";

const PUBLIC_PATHS = ["/auth", "/join"];

// Paths reachable during / immediately after onboarding
// before userType is set — guard must not redirect these.
const ONBOARDING_FLOW_PATHS = [
  "/onboarding",
  "/org/new",
  "/org/setup",
  "/join",
  "/super",   // super admin — has its own layout-level role guard
];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router   = useRouter();
  const pathname = usePathname();

  const loadUser = useCallback(async () => {
    try {
      const anonId  = typeof window !== "undefined"
        ? localStorage.getItem("trm_anonymous_id") ?? undefined
        : undefined;
      const appUser = await ensureAuthUser(anonId);
      setUser(appUser);
      return appUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_IN") {
          const appUser = await loadUser();
          if (appUser && appUser.userType === null) {
            // Super admins skip onboarding — they go straight to /super
            if (checkSuperAdmin(appUser)) {
              router.push("/super");
            } else {
              router.push(ONBOARD_PATH);
            }
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

    const isPublic      = PUBLIC_PATHS.some(p => pathname.startsWith(p));
    const isOnboardFlow = ONBOARDING_FLOW_PATHS.some(p => pathname.startsWith(p));

    if (isPublic || isOnboardFlow) return;

    if (user.userType === null) {
      // Super admins with no userType yet → /super, not onboarding
      if (checkSuperAdmin(user)) {
        router.push("/super");
      } else {
        router.push(ONBOARD_PATH);
      }
    }
  }, [user, loading, pathname, router]);

  const handleSetActiveOrg = useCallback(async (orgId: string) => {
    await setActiveOrgRpc(orgId);
    await loadUser();  // re-fetch so orgId + activeOrgId update everywhere
  }, [loadUser]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      refresh:      async () => { await loadUser(); },
      isSuperAdmin: checkSuperAdmin(user),
      activeOrgId:  user?.activeOrgId ?? null,
      orgIds:       user?.orgIds ?? [],
      setActiveOrg: handleSetActiveOrg,
    }}>
      {children}
    </AuthContext.Provider>
  );
}