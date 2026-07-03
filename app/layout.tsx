// ============================================================
// app/layout.tsx
//
// Changes:
//   - Inline blocking <script> reads trm_theme from localStorage
//     and sets class="dark" on <html> BEFORE React hydrates.
//     This prevents the flash of wrong theme on first load.
//   - ThemeProvider wraps the app so any component can call
//     useTheme() to read or change the current theme.
// ============================================================

import type { Metadata } from "next";
import { Manrope }       from "next/font/google";
import "./globals.css";
import NavBar        from "@/components/NavBar";
import AuthProvider  from "@/components/AuthProvider";
import ThemeProvider from "@/components/ThemeProvider";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trade Risk Manager",
  description: "Position sizing calculator for Indian equities (NSE/BSE)",
};

// This script runs synchronously before React — prevents flash
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('trm_theme') || 'dark';
    var resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    if (resolved === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script — must be first in <head> */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }}/>
      </head>
      <body className={`${manrope.className} antialiased min-h-screen`}>
        <ThemeProvider>
          <AuthProvider>
            <NavBar/>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}