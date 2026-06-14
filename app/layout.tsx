// ============================================================
// app/layout.tsx
// Root layout — NavBar appears on every page.
// ============================================================

import type { Metadata } from "next";
import { Manrope }       from "next/font/google";
import "./globals.css";
import NavBar        from "@/components/NavBar";
import AuthProvider  from "@/components/AuthProvider";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trade Risk Manager",
  description: "Position sizing calculator for Indian equities (NSE/BSE)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${manrope.className} antialiased min-h-screen text-slate-100`}
        style={{ backgroundColor: "#0d1117" }}
      >
        <AuthProvider>
          <NavBar/>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}