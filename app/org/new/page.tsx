"use client";

// ============================================================
// app/org/new/page.tsx
// Create a new organisation. Caller becomes the owner.
// Previously app/org/setup/page.tsx — moved to /org/new.
// ============================================================

import { useState }          from "react";
import { useRouter }         from "next/navigation";
import { useAuth }           from "@/components/AuthProvider";
import { createOrganisation } from "@/lib/db/org";

const inputClass =
  "w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 " +
  "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export default function OrgNewPage() {
  const { user, refresh } = useAuth();
  const router            = useRouter();

  const [name,    setName]    = useState("");
  const [domain,  setDomain]  = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await createOrganisation(name.trim(), user.id, domain.trim() || undefined);
      await refresh();                   // reload AppUser with new userType/orgId
      router.replace("/org/settings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organisation.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md flex flex-col gap-8">

        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Create your organisation
          </h1>
          <p className="text-sm text-slate-400">
            You'll be the owner. Invite traders and co-admins from settings.
          </p>
        </div>

        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6
            flex flex-col gap-4 shadow-xl"
        >
          {error && (
            <div className="rounded-xl border border-red-700 bg-red-900/30
              px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-300">
              Organisation name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. Acme Capital"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-300">
              Email domain <span className="text-slate-600">(optional)</span>
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="e.g. acmecapital.com"
              value={domain}
              onChange={e => setDomain(e.target.value)}
            />
            <p className="text-xs text-slate-600">
              If set, only emails from this domain can join via invite.
              This is enforced server-side.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold
              text-white hover:bg-blue-500 transition-colors disabled:opacity-50
              disabled:cursor-not-allowed focus:outline-none focus:ring-2
              focus:ring-blue-400 mt-2"
          >
            {loading ? "Creating…" : "Create organisation"}
          </button>
        </form>
      </div>
    </main>
  );
}