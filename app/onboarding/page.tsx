"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth }      from "@/components/AuthProvider";
import { setIndieUser, createOrganisation } from "@/lib/db/org";

type Step = "pick_type" | "indie_currency" | "indie_confirm" | "org_pick" | "org_currency" | "org_join";
type Currency = "INR" | "USD";

function Card({ onClick, accent, icon, title, sub }: {
  onClick: () => void; accent: string;
  icon: React.ReactNode; title: string; sub: string;
}) {
  return (
    <button onClick={onClick}
      className={`rounded-2xl border bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-4
        text-left transition-all hover:bg-slate-50 dark:hover:bg-slate-800
        focus:outline-none focus:ring-2 ${accent}`}>
      {icon}
      <div>
        <p className="font-semibold text-slate-800 dark:text-slate-200">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{sub}</p>
      </div>
    </button>
  );
}

function CurrencyPicker({ value, onChange }: {
  value: Currency; onChange: (c: Currency) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {([
        { code: "INR" as Currency, flag: "🇮🇳", label: "Indian Rupee", sub: "NSE & BSE · Nifty 500" },
        { code: "USD" as Currency, flag: "🇺🇸", label: "US Dollar",    sub: "NYSE & NASDAQ · S&P 500" },
      ] as const).map(opt => (
        <button key={opt.code} onClick={() => onChange(opt.code)}
          className={`rounded-2xl border p-5 flex flex-col gap-2 text-left transition-all
            focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            value === opt.code
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/30"
              : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-500"
          }`}>
          <span className="text-3xl">{opt.flag}</span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {opt.code} — {opt.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{opt.sub}</p>
          </div>
          {value === opt.code && (
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">✓ Selected</span>
          )}
        </button>
      ))}
    </div>
  );
}

function OnboardingInner() {
  const { user, refresh } = useAuth();
  const router            = useRouter();
  const searchParams      = useSearchParams();

  const [step,       setStep]       = useState<Step>(
    (searchParams.get("step") as Step) ?? "pick_type"
  );
  const [currency,   setCurrency]   = useState<Currency>("INR");
  const [inviteCode, setInviteCode] = useState("");
  const [orgName,    setOrgName]    = useState("");
  const [orgDomain,  setOrgDomain]  = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const firstName = user?.name?.split(" ")[0] ?? "";

  async function handleIndie() {
    if (!user) return;
    setLoading(true); setError(null);
    try {
      await setIndieUser(user.id, currency);
      await refresh();
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !orgName.trim()) return;
    setLoading(true); setError(null);
    try {
      await createOrganisation(orgName.trim(), user.id, orgDomain.trim() || undefined, currency);
      await refresh();
      router.replace("/org/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organisation.");
      setLoading(false);
    }
  }

  function handleJoinWithCode() {
    const code = inviteCode.trim();
    if (!code) return;
    const match = code.match(/\/join\/([^/?#]+)/);
    router.push(`/join/${match ? match[1] : code}`);
  }

  const inputClass = "w-full rounded-lg border border-slate-300 dark:border-slate-600 " +
    "bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 " +
    "placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
    "focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

  const backBtn = (to: Step) => (
    <button onClick={() => setStep(to)}
      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
        transition-colors text-center pt-1">
      ← Back
    </button>
  );

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10
      bg-slate-50 dark:bg-[#0d1117]">
      <div className="w-full max-w-lg flex flex-col gap-8">

        <div className="text-center flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            How will you be using Trade Risk Manager?
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-300 dark:border-red-700
            bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Step 1 — pick type */}
        {step === "pick_type" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card onClick={() => setStep("indie_currency")}
              accent="border-slate-200 dark:border-slate-700 hover:border-blue-500 focus:ring-blue-500"
              icon={
                <svg className="w-8 h-8 text-blue-400" viewBox="0 0 32 32" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="16" cy="10" r="5"/>
                  <path d="M6 28c0-5.523 4.477-10 10-10s10 4.477 10 10"/>
                </svg>
              }
              title="I trade solo"
              sub="Independent retail trader. Full control, private portfolio."
            />
            <Card onClick={() => setStep("org_pick")}
              accent="border-slate-200 dark:border-slate-700 hover:border-emerald-500 focus:ring-emerald-500"
              icon={
                <svg className="w-8 h-8 text-emerald-400" viewBox="0 0 32 32" fill="none"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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

        {/* Step 2a — indie currency */}
        {step === "indie_currency" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Which market do you trade?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                This sets your default currency and stock list. You can still enter any ticker manually.
              </p>
            </div>
            <CurrencyPicker value={currency} onChange={setCurrency}/>
            <div className="flex gap-3">
              <button onClick={() => setStep("pick_type")}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600
                  px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400
                  hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Back
              </button>
              <button onClick={() => setStep("indie_confirm")}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-500 transition-colors">
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 2b — indie confirm */}
        {step === "indie_confirm" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 p-3 rounded-xl
              bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-700">
              <span className="text-2xl">{currency === "INR" ? "🇮🇳" : "🇺🇸"}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {currency === "INR" ? "Indian Markets (INR)" : "US Markets (USD)"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500">
                  {currency === "INR" ? "NSE & BSE · Nifty 500" : "NYSE & NASDAQ · S&P 500"}
                </p>
              </div>
              <button onClick={() => setStep("indie_currency")}
                className="ml-auto text-xs text-blue-500 hover:text-blue-400 underline">
                Change
              </button>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Full control of your trades and portfolio. No one else can see your data.
              You can join an organisation later via an invite link.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setStep("indie_currency")}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600
                  px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400
                  hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Back
              </button>
              <button onClick={handleIndie} disabled={loading}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                {loading ? "Setting up…" : "Get started"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — org: admin or join */}
        {step === "org_pick" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-4">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Are you setting up a new desk, or joining an existing one?
            </p>
            <div className="flex flex-col gap-3">
              <button onClick={() => setStep("org_currency")}
                className="w-full rounded-xl border border-emerald-600 dark:border-emerald-700
                  bg-emerald-50 dark:bg-emerald-900/20 px-4 py-4 text-left
                  hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Create an organisation
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-700 mt-0.5">
                  I'm the admin / setting up a new trading desk
                </p>
              </button>
              <button onClick={() => setStep("org_join")}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-600
                  bg-slate-50 dark:bg-slate-700/40 px-4 py-4 text-left
                  hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Join with an invite
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                  I have an invite link or code from my admin
                </p>
              </button>
            </div>
            {backBtn("pick_type")}
          </div>
        )}

        {/* Step 4 — org currency picker */}
        {step === "org_currency" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-5">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Which market does your desk trade?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                All members of this organisation will trade in the same currency.
                This cannot be changed after creation.
              </p>
            </div>
            <CurrencyPicker value={currency} onChange={setCurrency}/>

            {/* Org name + domain inline */}
            <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Organisation name <span className="text-red-400">*</span>
                </label>
                <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Capital" className={inputClass}/>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email domain <span className="text-slate-400 dark:text-slate-500">(optional)</span>
                </label>
                <input type="text" value={orgDomain} onChange={e => setOrgDomain(e.target.value)}
                  placeholder="e.g. acmecapital.com" className={inputClass}/>
                <p className="text-xs text-slate-400 dark:text-slate-600">
                  Only emails from this domain can join via invite.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep("org_pick")}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600
                  px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400
                  hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Back
              </button>
              <button onClick={handleCreateOrg as any} disabled={loading || !orgName.trim()}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-emerald-500 transition-colors disabled:opacity-40">
                {loading ? "Creating…" : "Create organisation"}
              </button>
            </div>
          </div>
        )}

        {/* Step 5 — join with code */}
        {step === "org_join" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700
            bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Invite link or code
              </label>
              <input type="text" placeholder="https://… or paste your code"
                value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleJoinWithCode()}
                className={inputClass} autoFocus/>
              <p className="text-xs text-slate-400 dark:text-slate-600">
                Your market and currency will be set by the organisation you join.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("org_pick")}
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600
                  px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400
                  hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                Back
              </button>
              <button onClick={handleJoinWithCode} disabled={!inviteCode.trim()}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm
                  font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-50">
                Continue
              </button>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0d1117]">
        <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"/>
      </main>
    }>
      <OnboardingInner/>
    </Suspense>
  );
}