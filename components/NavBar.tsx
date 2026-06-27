"use client";

// ============================================================
// components/NavBar.tsx
//
// Changes vs original:
//   - Org admins see "Org" nav section with Settings,
//     Leaderboard, and Admin links
//   - Profile dropdown shows org role badge
//   - "Join an organisation" option above Sign out for
//     non-admin org members and indie users
// ============================================================

import Link                      from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth }                from "@/components/AuthProvider";
import { signOut }                from "@/lib/auth";
import { useState, useRef, useEffect } from "react";

const NAV_LINKS = [
  { href: "/",          label: "Calculator" },
  { href: "/dashboard", label: "Dashboard"  },
  { href: "/ledger",    label: "Ledger"     },
];

const ORG_LINKS = [
  { href: "/leaderboard",  label: "Leaderboard" },
  { href: "/org/admin",    label: "Team"         },
  { href: "/org/settings", label: "Settings"     },
];

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4l4 4 4-4"/>
    </svg>
  );
}

export default function NavBar() {
  const pathname          = usePathname();
  const router            = useRouter();
  const { user, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOrgAdmin  = user?.userType === "org_admin";
  const isOrgMember = user?.userType === "org_member" || isOrgAdmin;
  const canJoinOrg  = user && !isOrgAdmin; // indie or member can join another org

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setMenuOpen(false);
    await signOut();
    router.push("/auth");
  }

  function handleJoinOrg() {
    setMenuOpen(false);
    // Send to onboarding org_join step via query param
    router.push("/onboarding?step=org_pick");
  }

  if (pathname === "/auth") return null;

  const orgActive = ORG_LINKS.some(l => pathname.startsWith(l.href));

  const roleBadge =
    user?.userType === "org_admin"   ? { label: "Admin",  style: "border-amber-700 text-amber-400 bg-amber-900/20"   } :
    user?.userType === "org_member"  ? { label: "Member", style: "border-slate-600 text-slate-400 bg-slate-800/40"   } :
    user?.userType === "indie"       ? { label: "Indie",  style: "border-blue-800 text-blue-400 bg-blue-900/20"      } :
    null;

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-slate-800">

      {/* Brand */}
      <span className="text-sm font-semibold tracking-tight text-slate-300">
        Trade Risk Manager
      </span>

      {/* Nav links */}
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

          {/* Org section — admins only */}
          {isOrgAdmin && (
            <>
              <div className="w-px h-4 bg-slate-700 mx-1"/>
              {ORG_LINKS.map(({ href, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link key={href} href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-emerald-900/40 text-emerald-300"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                    }`}>
                    {label}
                  </Link>
                );
              })}
            </>
          )}

          {/* Leaderboard only — for org members (non-admin) */}
          {isOrgMember && !isOrgAdmin && (
            <>
              <div className="w-px h-4 bg-slate-700 mx-1"/>
              <Link href="/leaderboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/leaderboard"
                    ? "bg-slate-700 text-slate-100"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                }`}>
                Leaderboard
              </Link>
            </>
          )}
        </div>
      )}

      {/* User area */}
      <div className="flex items-center gap-3" ref={menuRef}>
        {loading ? (
          <div className="w-7 h-7 rounded-full bg-slate-700 animate-pulse"/>
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-full focus:outline-none
                focus:ring-2 focus:ring-blue-500 pl-1"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name}
                  className="w-7 h-7 rounded-full border border-slate-600"/>
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center
                  justify-center text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <ChevronIcon open={menuOpen}/>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border
                border-slate-700 bg-slate-900 shadow-2xl p-2 z-50 flex flex-col gap-0.5">

                {/* User info */}
                <div className="px-3 py-2.5 border-b border-slate-800 mb-1">
                  <p className="text-xs font-medium text-slate-200 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  {roleBadge && (
                    <span className={`mt-1.5 inline-block text-xs px-1.5 py-0.5 rounded
                      border ${roleBadge.style}`}>
                      {roleBadge.label}
                    </span>
                  )}
                </div>

                {/* Org quick links for admins */}
                {isOrgAdmin && (
                  <>
                    {ORG_LINKS.map(({ href, label }) => (
                      <Link key={href} href={href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm
                          text-slate-400 hover:text-slate-200 hover:bg-slate-800
                          rounded-lg transition-colors">
                        {label}
                      </Link>
                    ))}
                    <div className="border-t border-slate-800 my-1"/>
                  </>
                )}

                {/* Join org — for indie users and members (can join another) */}
                {canJoinOrg && (
                  <button
                    onClick={handleJoinOrg}
                    className="w-full text-left flex items-center gap-2 px-3 py-2
                      text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800
                      rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none"
                      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
                      strokeLinejoin="round">
                      <circle cx="6" cy="5" r="3"/>
                      <path d="M2 14c0-3 1.8-5 4-5"/>
                      <path d="M12 9v6M9 12h6"/>
                    </svg>
                    Join an organisation
                  </button>
                )}

                {/* Sign out */}
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full text-left flex items-center gap-2 px-3 py-2
                    text-sm text-red-400 hover:bg-red-900/20 rounded-lg
                    transition-colors disabled:opacity-40"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none"
                    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
                    strokeLinejoin="round">
                    <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>
                    <path d="M10 11l3-3-3-3M13 8H6"/>
                  </svg>
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