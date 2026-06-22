"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth }   from "@/components/AuthProvider";
import { setIndieUser } from "@/lib/db/org";

function SoloIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="10" r="5"/>
      <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
    </svg>
  );
}

function OrgIcon() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="4"/>
      <circle cx="22" cy="10" r="4"/>
      <circle cx="16" cy="22" r="4"/>
      <path d="M10 14c0 3 2 5 6 6M22 14c0 3-2 5-6 6"/>
    </svg>
  );
}

type Choice = "indie" | "org_create" | "org_join" | null;

export default function OnboardingPage() {
  const { user }   = useAuth();
  const router     = useRouter();
  const [choice,   setChoice]   = useState<Choice>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  async function handleIndie() {
    if (!user) return;
    setLoading(true);
    try {
      await setIndieUser(user.id);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleJoinWithCode() {
    if (!inviteCode.trim()) return;
    router.push(`/join/${inviteCode.trim()}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg flex flex-col gap-8">

        {/* Header */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-slate-400">
            How will you be using Trade Risk Manager?
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Choice cards */}
        {!choice && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Solo */}
            <button
              onClick={() => setChoice("indie")}
              className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
                flex flex-col gap-4 text-left transition-all hover:border-blue-500
                hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="text-blue-400"><SoloIcon/></div>
              <div>
                <p className="font-semibold text-slate-200">I trade solo</p>
                <p className="text-xs text-slate-500 mt-1">
                  Independent retail trader. Full control, private portfolio.
                </p>
              </div>
            </button>

            {/* Org */}
            <button
              onClick={() => setChoice("org_create")}
              className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
                flex flex-col gap-4 text-left transition-all hover:border-emerald-500
                hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <div className="text-emerald-400"><OrgIcon/></div>
              <div>
                <p className="font-semibold text-slate-200">I'm part of a firm</p>
                <p className="text-xs text-slate-500 mt-1">
                  Trading desk or organisation. Shared leaderboard and admin oversight.
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Solo confirmation */}
        {choice === "indie" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
            flex flex-col gap-4">
            <p className="text-sm text-slate-300">
              You'll have full control of your trades and portfolio. No one else can
              see your data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setChoice(null)}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5
                  text-sm text-slate-400 hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleIndie}
                disabled={loading}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-500 transition-colors
                  disabled:opacity-50"
              >
                {loading ? "Setting up…" : "Get started"}
              </button>
            </div>
          </div>
        )}

        {/* Org options */}
        {choice === "org_create" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
            flex flex-col gap-4">
            <p className="text-sm text-slate-400">Choose how you're joining:</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/org/setup")}
                className="w-full rounded-xl border border-emerald-700 bg-emerald-900/20
                  px-4 py-3 text-sm font-medium text-emerald-400 text-left
                  hover:bg-emerald-900/40 transition-colors"
              >
                <p className="font-semibold">Create an organisation</p>
                <p className="text-xs text-emerald-600 mt-0.5">
                  I'm setting up a new trading desk
                </p>
              </button>

              <button
                onClick={() => setChoice("org_join")}
                className="w-full rounded-xl border border-slate-600 bg-slate-700/40
                  px-4 py-3 text-sm font-medium text-slate-300 text-left
                  hover:bg-slate-700 transition-colors"
              >
                <p className="font-semibold">Join with an invite</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  I have an invite code from my admin
                </p>
              </button>
            </div>

            <button
              onClick={() => setChoice(null)}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors text-center"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Join with code */}
        {choice === "org_join" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
            flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-300">Invite code</label>
              <input
                type="text"
                placeholder="Paste your invite code here"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.trim())}
                className="w-full rounded-lg border border-slate-600 bg-slate-800
                  px-3 py-2 text-slate-100 placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
              <p className="text-xs text-slate-600">
                Ask your admin for an invite link or code.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setChoice("org_create")}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5
                  text-sm text-slate-400 hover:bg-slate-700 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleJoinWithCode}
                disabled={!inviteCode.trim()}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-500 transition-colors
                  disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}