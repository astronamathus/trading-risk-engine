"use client";

// ============================================================
// app/onboarding/page.tsx
//
// Three-tier onboarding:
//   1. Indie  → setIndieUser → /dashboard
//   2. Org admin → /org/new  (create org)
//   3. Org member → enter invite code → /join/[code]
// ============================================================

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth }     from "@/components/AuthProvider";
import { setIndieUser } from "@/lib/db/org";

type Step = "pick_type" | "indie_confirm" | "org_pick" | "org_join";

function Card({
  onClick, accent, icon, title, sub,
}: {
  onClick: () => void;
  accent:  string;
  icon:    React.ReactNode;
  title:   string;
  sub:     string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border bg-slate-800/50 p-6 flex flex-col gap-4
        text-left transition-all hover:bg-slate-800 focus:outline-none
        focus:ring-2 ${accent}`}
    >
      {icon}
      <div>
        <p className="font-semibold text-slate-200">{title}</p>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
      </div>
    </button>
  );
}

export default function OnboardingPage() {
  const { user, refresh } = useAuth();
  const router            = useRouter();
  const searchParams      = useSearchParams();

  const [step,       setStep]       = useState<Step>(
    (searchParams.get("step") as Step) ?? "pick_type"
  );
  const [inviteCode, setInviteCode] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const firstName = user?.name?.split(" ")[0] ?? "";

  async function handleIndie() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      await setIndieUser(user.id);
      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  function handleJoinWithCode() {
    const code = inviteCode.trim();
    if (!code) return;
    // Accept full invite URL or bare code
    const match = code.match(/\/join\/([^/?#]+)/);
    router.push(`/join/${match ? match[1] : code}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg flex flex-col gap-8">

        <div className="text-center flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Welcome{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-slate-400">
            How will you be using Trade Risk Manager?
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30
            px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {/* Step 1 — pick type */}
        {step === "pick_type" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card
              onClick={() => setStep("indie_confirm")}
              accent="border-slate-700 hover:border-blue-500 focus:ring-blue-500"
              icon={
                <svg className="w-8 h-8 text-blue-400" viewBox="0 0 32 32" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  strokeLinejoin="round">
                  <circle cx="16" cy="10" r="5"/>
                  <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
                </svg>
              }
              title="I trade solo"
              sub="Independent retail trader. Full control, private portfolio."
            />
            <Card
              onClick={() => setStep("org_pick")}
              accent="border-slate-700 hover:border-emerald-500 focus:ring-emerald-500"
              icon={
                <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 32 32" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                  strokeLinejoin="round">
                  <circle cx="10" cy="10" r="4"/>
                  <circle cx="22" cy="10" r="4"/>
                  <circle cx="16" cy="22" r="4"/>
                  <path d="M10 14c0 3 2 5 6 6M22 14c0 3-2 5-6 6"/>
                </svg>
              }
              title="I'm part of a firm"
              sub="Trading desk or organisation. Shared leaderboard and admin oversight."
            />
          </div>
        )}

        {/* Step 2a — indie confirm */}
        {step === "indie_confirm" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50
            p-6 flex flex-col gap-4">
            <p className="text-sm text-slate-300">
              You'll have full control of your trades and portfolio.
              No one else can see your data. You can join an organisation
              later at any time via an invite link.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep("pick_type")}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5
                  text-sm text-slate-400 hover:bg-slate-700 transition-colors">
                Back
              </button>
              <button onClick={handleIndie} disabled={loading}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-500 transition-colors
                  disabled:opacity-50">
                {loading ? "Setting up…" : "Get started"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2b — org: admin or member */}
        {step === "org_pick" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50
            p-6 flex flex-col gap-4">
            <p className="text-sm font-medium text-slate-400">
              Are you setting up a new desk, or joining an existing one?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/org/new")}
                className="w-full rounded-xl border border-emerald-700 bg-emerald-900/20
                  px-4 py-4 text-left hover:bg-emerald-900/40 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <p className="text-sm font-semibold text-emerald-400">
                  Create an organisation
                </p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  I'm the admin / setting up a new trading desk
                </p>
              </button>
              <button
                onClick={() => setStep("org_join")}
                className="w-full rounded-xl border border-slate-600 bg-slate-700/40
                  px-4 py-4 text-left hover:bg-slate-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <p className="text-sm font-semibold text-slate-300">
                  Join with an invite
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  I have an invite link or code from my admin
                </p>
              </button>
            </div>
            <button onClick={() => setStep("pick_type")}
              className="text-xs text-slate-600 hover:text-slate-400
                transition-colors text-center pt-1">
              ← Back
            </button>
          </div>
        )}

        {/* Step 2c — enter invite code */}
        {step === "org_join" && (
          <div className="rounded-2xl border border-slate-700 bg-slate-800/50
            p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-300">
                Invite link or code
              </label>
              <input
                type="text"
                placeholder="https://… or paste your code"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleJoinWithCode()}
                className="w-full rounded-lg border border-slate-600 bg-slate-800
                  px-3 py-2 text-slate-100 placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
              />
              <p className="text-xs text-slate-600">
                You can paste the full invite URL or just the code.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("org_pick")}
                className="flex-1 rounded-xl border border-slate-600 px-4 py-2.5
                  text-sm text-slate-400 hover:bg-slate-700 transition-colors">
                Back
              </button>
              <button onClick={handleJoinWithCode} disabled={!inviteCode.trim()}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-500 transition-colors
                  disabled:opacity-50">
                Continue
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}