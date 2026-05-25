// ============================================================
// components/NavBar.tsx
// Minimal top navigation. Links to Calculator and Ledger.
// Uses Next.js <Link> for client-side navigation (no reload).
// ============================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",       label: "Calculator" },
  { href: "/ledger", label: "Ledger"     },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
      {/* Brand */}
      <span className="text-sm font-semibold tracking-tight text-slate-300">
        Trade Risk Manager
      </span>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {links.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-slate-700 text-slate-100"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}