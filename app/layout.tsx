// ============================================================
// app/layout.tsx
// Root layout — NavBar appears on every page.
// ============================================================

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trade Risk Manager",
  description: "Position sizing calculator for Indian equities (NSE/BSE)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-slate-900 text-slate-100 min-h-screen`}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}