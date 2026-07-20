"use client";

// ============================================================
// app/super/layout.tsx
//
// Route guard for all /super/* pages.
// Redirects anyone who isn't role === "admin" to /dashboard.
// Child pages (page.tsx, [orgId]/page.tsx, new/page.tsx) can
// assume isSuperAdmin is true — no need to re-check.
// ============================================================

import { useEffect }  from "react";
import { useRouter }  from "next/navigation";
import { useAuth }    from "@/components/AuthProvider";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isSuperAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user)          { router.replace("/auth");      return; }
    if (!isSuperAdmin)  { router.replace("/dashboard"); return; }
  }, [user, loading, isSuperAdmin, router]);

  // While auth is resolving, show the same spinner pattern used elsewhere
  if (loading || !isSuperAdmin) {
    return (
      <main className="flex items-center justify-center min-h-[60vh] gap-3
        text-slate-400 dark:text-slate-500">
        <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-sm">Loading…</span>
      </main>
    );
  }

  return <>{children}</>;
}