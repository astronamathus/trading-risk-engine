"use client";

// ============================================================
// app/super/new/page.tsx
//
// Super admin: create a new org and assign an existing user
// as owner by email. Calls super_admin_create_org RPC.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase }  from "@/lib/supabase";

const inputClass =
  "rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 " +
  "px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm w-full";

export default function SuperAdminNewOrgPage() {
  const router = useRouter();

  const [name,       setName]       = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [domain,     setDomain]     = useState("");
  const [currency,   setCurrency]   = useState<"INR" | "USD">("INR");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !ownerEmail.trim()) {
      setError("Org name and owner email are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc("super_admin_create_org", {
        p_name:        name.trim(),
        p_owner_email: ownerEmail.trim().toLowerCase(),
        p_domain:      domain.trim() || null,
        p_currency:    currency,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data?.ok) throw new Error(data?.error ?? "Failed to create org");
      // Navigate to the new org's detail page
      router.push(`/super/${data.org_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create.");
      setSaving(false);
    }
  }

  return (
    <main className="px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg flex flex-col gap-8">

        {/* Header */}
        <div>
          <button
            onClick={() => router.push("/super")}
            className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500
              hover:text-slate-700 dark:hover:text-slate-300 transition-colors mb-4">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 4L6 8l4 4"/>
            </svg>
            All orgs
          </button>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded-full border border-purple-700
              text-purple-400 bg-purple-900/20 font-medium">
              Super Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Create Organisation
          </h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
            The owner must already have signed in at least once.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-900/30 px-4 py-3
            text-sm text-red-300">{error}</div>
        )}

        {/* Form */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-700
          bg-white dark:bg-slate-800/50 p-6 flex flex-col gap-5">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400
              uppercase tracking-wider">
              Organisation name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Apex Trading Desk"
              value={name}
              onChange={e => { setName(e.target.value); setError(null); }}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              autoFocus
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400
              uppercase tracking-wider">
              Owner email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              placeholder="owner@firm.com"
              value={ownerEmail}
              onChange={e => { setOwnerEmail(e.target.value); setError(null); }}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              className={inputClass}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Must match the email they used to sign in with Google.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400
              uppercase tracking-wider">
              Domain <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. apextrading.com"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              If set, only emails from this domain can join via invite.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400
              uppercase tracking-wider">
              Currency
            </label>
            <div className="flex gap-2">
              {(["INR", "USD"] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCurrency(c)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium
                    transition-colors ${currency === c
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400"
                    }`}>
                  {c === "INR" ? "₹ INR" : "$ USD"}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/super")}
            disabled={saving}
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-600
              px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400
              hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim() || !ownerEmail.trim()}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold
              text-white hover:bg-blue-500 transition-colors disabled:opacity-40">
            {saving ? "Creating…" : "Create organisation"}
          </button>
        </div>

      </div>
    </main>
  );
}