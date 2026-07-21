"use client";

// ============================================================
// components/OrgSwitcher.tsx
//
// Shown in NavBar dropdown and org/settings header for super
// admins who own multiple orgs. Calls setActiveOrg from
// AuthProvider, which hits the RPC + re-fetches the user so
// all pages see the updated activeOrgId immediately.
// ============================================================

import { useState } from "react";
import { useAuth }  from "@/components/AuthProvider";
import { getUserOrgs } from "@/lib/db/org";
import type { Organisation } from "@/lib/db/org";

interface Props {
  orgs:         Organisation[];
  activeOrgId:  string | null;
  onSwitch?:    () => void;   // optional callback after switch (e.g. close dropdown)
}

export function OrgSwitcher({ orgs, activeOrgId, onSwitch }: Props) {
  const { setActiveOrg } = useAuth();
  const [switching, setSwitching] = useState<string | null>(null);

  if (orgs.length < 2) return null;

  async function handleSwitch(orgId: string) {
    if (orgId === activeOrgId || switching) return;
    setSwitching(orgId);
    try {
      await setActiveOrg(orgId);
      onSwitch?.();
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      {orgs.map(org => {
        const isActive = org.id === activeOrgId;
        const isBusy   = switching === org.id;
        return (
          <button
            key={org.id}
            onClick={() => handleSwitch(org.id)}
            disabled={isActive || !!switching}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
              transition-colors text-left disabled:cursor-default ${
              isActive
                ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isActive ? "bg-purple-500" : "bg-transparent"
            }`}/>
            <span className="truncate flex-1">{org.name}</span>
            {isBusy && (
              <svg className="animate-spin h-3 w-3 shrink-0 text-purple-400"
                viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"/>
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Hook: loads all orgs for a super admin ────────────────────
// Used in settings page header + NavBar to populate the switcher.
import { useEffect, useState as useStateInner } from "react";

export function useOwnedOrgs(userId: string | undefined, isSuperAdmin: boolean) {
  const [orgs,    setOrgs]    = useStateInner<Organisation[]>([]);
  const [loading, setLoading] = useStateInner(true);

  useEffect(() => {
    if (!userId || !isSuperAdmin) { setLoading(false); return; }
    getUserOrgs(userId).then(o => { setOrgs(o); setLoading(false); });
  }, [userId, isSuperAdmin]);

  return { orgs, loading };
}