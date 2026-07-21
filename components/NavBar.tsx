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
//   - Super admins see "Super Admin" nav link + dropdown section
// ============================================================

import Link                      from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth }                from "@/components/AuthProvider";
import { useTheme }               from "@/components/ThemeProvider";
import type { Theme }             from "@/components/ThemeProvider";
import { signOut }                from "@/lib/auth";
import { useState, useRef, useEffect } from "react";
import { OrgSwitcher, useOwnedOrgs } from "@/components/OrgSwitcher";

const NAV_LINKS = [
  { href: "/",          label: "Trade" },
  { href: "/dashboard", label: "Dashboard"  },
  { href: "/ledger",    label: "Ledger"     },
];

const ORG_LINKS = [
  { href: "/leaderboard",  label: "Leaderboard" },
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

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-3.5 h-3.5"} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3"/>
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-3.5 h-3.5"} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z"/>
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "w-3.5 h-3.5"} viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="2" width="14" height="10" rx="1.5"/>
      <path d="M5 14h6M8 12v2"/>
    </svg>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof SunIcon }[] = [
  { value: "light",  label: "Light",  Icon: SunIcon     },
  { value: "dark",   label: "Dark",   Icon: MoonIcon    },
  { value: "system", label: "System", Icon: MonitorIcon },
];

export default function NavBar() {
  const pathname            = usePathname();
  const router              = useRouter();
  const { user, loading, isSuperAdmin } = useAuth();
  const { theme, setTheme } = useTheme();

  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { orgs: ownedOrgs } = useOwnedOrgs(user?.id, isSuperAdmin);
  const { activeOrgId }     = useAuth();
  const isOrgAdmin  = user?.userType === "org_admin";
  const isOrgMember = user?.userType === "org_member" || isOrgAdmin;
  const canJoinOrg  = user && !isOrgAdmin;

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
    router.push("/onboarding?step=org_pick");
  }

  if (pathname === "/auth") return null;

  const roleBadge =
    user?.userType === "org_admin"  ? { label: "Admin",  style: "border-amber-700 text-amber-400 bg-amber-900/20"  } :
    user?.userType === "org_member" ? { label: "Member", style: "border-slate-600 text-slate-400 bg-slate-800/40"  } :
    user?.userType === "indie"      ? { label: "Indie",  style: "border-blue-800  text-blue-400  bg-blue-900/20"   } :
    null;

  // Adapt nav colours to light/dark
  const navBg     = "bg-white dark:bg-[#0d1117]";
  const navBorder = "border-slate-200 dark:border-slate-800";
  const brandTxt  = "text-slate-700 dark:text-slate-300";
  const linkBase  = "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-800";
  const linkActive = "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100";
  const dropBg    = "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700";
  const dropItem  = "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-800";
  const divider   = "border-slate-100 dark:border-slate-800";

  return (
    <nav className={`flex items-center justify-between px-6 py-3 border-b ${navBg} ${navBorder}`}>

      {/* Brand */}
      <span className={`text-sm font-semibold tracking-tight ${brandTxt}`}>
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
                  active ? linkActive : linkBase
                }`}>
                {label}
              </Link>
            );
          })}

          {isOrgAdmin && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"/>
              {ORG_LINKS.map(({ href, label }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link key={href} href={href}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                        : linkBase
                    }`}>
                    {label}
                  </Link>
                );
              })}
            </>
          )}

          {isOrgMember && !isOrgAdmin && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"/>
              <Link href="/leaderboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === "/leaderboard" ? linkActive : linkBase
                }`}>
                Leaderboard
              </Link>
            </>
          )}

          {isSuperAdmin && (
            <>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1"/>
              <Link href="/super"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith("/super")
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
                    : linkBase
                }`}>
                Super Admin
              </Link>
            </>
          )}
        </div>
      )}

      {/* User area */}
      <div className="flex items-center gap-3" ref={menuRef}>
        {loading ? (
          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse"/>
        ) : user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-1.5 rounded-full focus:outline-none
                focus:ring-2 focus:ring-blue-500 pl-1"
            >
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name}
                  className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-600"/>
              ) : (
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center
                  justify-center text-xs font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <ChevronIcon open={menuOpen}/>
            </button>

            {menuOpen && (
              <div className={`absolute right-0 top-full mt-2 w-56 rounded-xl border
                shadow-2xl p-2 z-50 flex flex-col gap-0.5 ${dropBg}`}>

                {/* User info */}
                <div className={`px-3 py-2.5 border-b ${divider} mb-1`}>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  {roleBadge && (
                    <span className={`mt-1.5 inline-block text-xs px-1.5 py-0.5 rounded border ${roleBadge.style}`}>
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
                        className={`flex items-center gap-2 px-3 py-2 text-sm
                          rounded-lg transition-colors ${dropItem}`}>
                        {label}
                      </Link>
                    ))}
                    <div className={`border-t ${divider} my-1`}/>
                  </>
                )}

                {/* Super admin section */}
                {isSuperAdmin && (
                  <>
                    <div className={`border-t ${divider} my-1`}/>
                    <p className="px-3 pt-1 text-xs text-purple-400 uppercase tracking-wider font-medium">
                      Super Admin
                    </p>
                    <Link href="/super"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm
                        rounded-lg transition-colors ${dropItem}`}>
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none"
                        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
                        strokeLinejoin="round">
                        <rect x="2" y="3" width="12" height="11" rx="1"/>
                        <path d="M5 14V9h6v5M8 3V1"/>
                        <rect x="5.5" y="5.5" width="2" height="2" rx="0.3"/>
                        <rect x="8.5" y="5.5" width="2" height="2" rx="0.3"/>
                      </svg>
                      All orgs
                    </Link>
                    <Link href="/super/new"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 text-sm
                        rounded-lg transition-colors ${dropItem}`}>
                      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none"
                        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
                        strokeLinejoin="round">
                        <path d="M8 3v10M3 8h10"/>
                      </svg>
                      Create org
                    </Link>
                    {/* Org switcher — only if super admin owns 2+ orgs */}
                    {ownedOrgs.length > 1 && (
                      <>
                        <p className="px-3 pt-2 pb-1 text-xs text-purple-400 uppercase tracking-wider font-medium">
                          Switch org
                        </p>
                        <OrgSwitcher
                          orgs={ownedOrgs}
                          activeOrgId={activeOrgId}
                          onSwitch={() => setMenuOpen(false)}
                        />
                      </>
                    )}
                    <div className={`border-t ${divider} my-1`}/>
                  </>
                )}

                {/* Join org */}
                {canJoinOrg && (
                  <button onClick={handleJoinOrg}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2
                      text-sm rounded-lg transition-colors ${dropItem}`}>
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

                {/* ── Theme picker ── */}
                <div className={`border-t ${divider} my-1`}/>
                <div className="px-3 py-1.5">
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-wider">
                    Appearance
                  </p>
                  <div className="flex gap-1">
                    {THEME_OPTIONS.map(({ value, label, Icon }) => {
                      const active = theme === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setTheme(value)}
                          title={label}
                          className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-lg
                            text-xs transition-colors ${
                            active
                              ? "bg-blue-600 text-white"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5"/>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sign out */}
                <div className={`border-t ${divider} my-1`}/>
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full text-left flex items-center gap-2 px-3 py-2
                    text-sm text-red-500 dark:text-red-400 hover:bg-red-50
                    dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40"
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
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${linkBase}`}>
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}