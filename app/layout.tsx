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

// Runs synchronously before React — prevents flash of wrong theme.
// Defaults to "system" (follows OS) for new users.
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('trm_theme') || 'system';
    var resolved = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch(e) {
    // If localStorage fails, follow OS preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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