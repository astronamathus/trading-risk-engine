// ============================================================
// components/NavBar.tsx
// Minimal top navigation. Links to Calculator and Ledger.
// Uses Next.js <Link> for client-side navigation (no reload).
// ============================================================
"use client";

import Link       from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth }   from "@/components/AuthProvider";
import { signOut }   from "@/lib/auth";
import { useState }  from "react";

const NAV_LINKS = [
  { href: "/",          label: "Calculator" },
  { href: "/dashboard", label: "Dashboard"  },
  { href: "/ledger",    label: "Ledger"     },
];

export default function NavBar() {
  const pathname         = usePathname();
  const router           = useRouter();
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push("/auth");
  }

  // Don't show nav on auth page
  if (pathname === "/auth") return null;

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-800">
      {/* Brand */}
      <span className="text-sm font-semibold tracking-tight text-slate-300">
        Trade Risk Manager
      </span>

      {/* Nav links — only if logged in */}
      {user && (
        <div className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}>
                {label}
              </Link>
            );
          })}
        </div>
      )}

      {/* User area */}
      <div className="flex items-center gap-3">
        {loading ? (
          <div className="w-7 h-7 rounded-full bg-slate-700 animate-pulse"/>
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 rounded-full focus:outline-none
                focus:ring-2 focus:ring-blue-500"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-7 h-7 rounded-full border border-slate-600"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center
                  justify-center text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border
                border-slate-700 bg-slate-900 shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-800 mb-1">
                  <p className="text-xs font-medium text-slate-200 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  {user.role === "admin" && (
                    <span className="mt-1 inline-block text-xs px-1.5 py-0.5 rounded
                      border border-amber-700 text-amber-400 bg-amber-900/20">
                      Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full text-left px-3 py-2 text-sm text-red-400
                    hover:bg-red-900/20 rounded-lg transition-colors
                    disabled:opacity-40"
                >
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link href="/auth"
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400
              hover:text-slate-200 hover:bg-slate-800 transition-colors">
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}