"use client";

import { useEffect, useState }  from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth }              from "@/components/AuthProvider";
import { getInviteByCode, acceptInvite } from "@/lib/db/org";
import type { OrgInvite, Organisation }  from "@/lib/db/org";

type InviteWithOrg = OrgInvite & { org: Organisation };
type PageState = "loading" | "found" | "invalid" | "joining" | "error";

export default function JoinPage() {
  const { user, loading: authLoading } = useAuth();
  const router  = useRouter();
  const params  = useParams();
  const code    = params.code as string;

  const [state,  setState]  = useState<PageState>("loading");
  const [invite, setInvite] = useState<InviteWithOrg | null>(null);
  const [error,  setError]  = useState<string | null>(null);

  // Load the invite
  useEffect(() => {
    if (authLoading) return;
    async function loadInvite() {
      const data = await getInviteByCode(code);
      if (!data) { setState("invalid"); return; }
      setInvite(data);
      setState("found");
    }
    loadInvite();
  }, [code, authLoading]);

  async function handleAccept() {
    if (!user || !invite) return;
    setState("joining");
    try {
      await acceptInvite(code, user.id);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join.");
      setState("error");
    }
  }

  // Not signed in — redirect to auth with return URL
  if (!authLoading && !user) {
    router.replace(`/auth?next=/join/${code}`);
    return null;
  }

  if (state === "loading" || authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center gap-3 text-slate-500">
        <svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-sm">Checking invite…</span>
      </main>
    );
  }

  if (state === "invalid") {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full flex flex-col gap-4 text-center">
          <div className="rounded-2xl border border-red-800 bg-red-900/20 p-8 flex flex-col gap-3">
            <svg className="w-10 h-10 mx-auto text-red-400" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
            </svg>
            <h2 className="text-lg font-semibold text-red-300">Invalid invite</h2>
            <p className="text-sm text-slate-400">
              This invite link is invalid, has expired, or has already been used.
              Ask your admin for a new one.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Go to dashboard →
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full flex flex-col gap-6">

        <div className="text-center flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-white">You're invited</h1>
          <p className="text-sm text-slate-400">
            You've been invited to join an organisation on Trade Risk Manager.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
          flex flex-col gap-5 shadow-xl">

          {/* Org details */}
          <div className="flex flex-col gap-1 border-b border-slate-700 pb-4">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Organisation</span>
            <span className="text-lg font-semibold text-slate-200">{invite?.org.name}</span>
            {invite?.role === "admin" && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-amber-700
                text-amber-400 bg-amber-900/20 w-fit mt-1">
                Admin role
              </span>
            )}
          </div>

          {/* Signed-in user */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Joining as</span>
            <div className="flex items-center gap-2">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name}
                  className="w-6 h-6 rounded-full border border-slate-600"/>
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center
                  justify-center text-xs font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-slate-300">{user?.email}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/30
              px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleAccept}
            disabled={state === "joining"}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold
              text-white hover:bg-emerald-500 transition-colors disabled:opacity-50
              focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {state === "joining" ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Joining…
              </span>
            ) : `Join ${invite?.org.name}`}
          </button>

          <p className="text-xs text-slate-600 text-center">
            Not you?{" "}
            <button onClick={() => router.push("/auth")}
              className="text-slate-500 hover:text-slate-300 underline">
              Sign in with a different account
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}