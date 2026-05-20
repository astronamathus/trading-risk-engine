// ============================================================
// app/layout.tsx
// Root layout — wraps every page in the app.
// A good place for: fonts, global metadata, nav, footer shell.
// ============================================================

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter is a clean, professional font — ideal for fintech UIs
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trade Risk Manager",
  description: "Position sizing calculator for Indian equities (NSE/BSE)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}