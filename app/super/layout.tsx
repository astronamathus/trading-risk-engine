// ============================================================
// app/super/layout.tsx
//
// Intentionally a Server Component (no "use client").
// Role guard is handled inline in each page via useAuth(),
// matching the pattern used by org/settings and leaderboard.
// A client layout wrapping client pages causes Turbopack 16
// to misidentify the module boundary.
// ============================================================

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}