"use client";

// ============================================================
// components/ThemeProvider.tsx
//
// Manages theme: "light" | "dark" | "system"
// - Persists to localStorage under "trm_theme"
// - "system" follows OS prefers-color-scheme
// - Applies/removes "dark" class on <html>
// - Default is "system" for new users
// ============================================================

import {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme:    Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:    "system",
  resolved: "light",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getSavedTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const saved = localStorage.getItem("trm_theme") as Theme | null;
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {}
  return "system";
}

function applyTheme(resolved: "light" | "dark") {
  const html = document.documentElement;
  if (resolved === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialise directly from localStorage so React state matches
  // what the blocking script already applied — no flash, no mismatch
  const [theme, setThemeState] = useState<Theme>(() => getSavedTheme());

  const resolved: "light" | "dark" =
    theme === "system" ? getSystemPref() : theme;

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("trm_theme", t); } catch {}
    const res = t === "system" ? getSystemPref() : t;
    applyTheme(res);
  }, []);

  // Sync DOM on mount (in case SSR/hydration differs)
  useEffect(() => {
    applyTheme(resolved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch OS preference when on "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handler() { applyTheme(mq.matches ? "dark" : "light"); }
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}