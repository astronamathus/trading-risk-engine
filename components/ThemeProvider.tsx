"use client";

// ============================================================
// components/ThemeProvider.tsx
//
// Manages theme: "light" | "dark" | "system"
// - Persists choice to localStorage under "trm_theme"
// - "system" follows the OS prefers-color-scheme media query
// - Applies/removes "dark" class on <html> element
// - Exposes useTheme() hook to any component
// ============================================================

import {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme:     Theme;
  resolved:  "light" | "dark";   // what's actually showing right now
  setTheme:  (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:    "dark",
  resolved: "dark",
  setTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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
  const [theme, setThemeState] = useState<Theme>("dark");

  const resolved: "light" | "dark" =
    theme === "system" ? getSystemPref() : theme;

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem("trm_theme", t);
    const res = t === "system" ? getSystemPref() : t;
    applyTheme(res);
  }, []);

  // On mount: read saved preference
  useEffect(() => {
    const saved = localStorage.getItem("trm_theme") as Theme | null;
    const initial = saved ?? "dark";
    setThemeState(initial);
    const res = initial === "system" ? getSystemPref() : initial;
    applyTheme(res);
  }, []);

  // Watch OS preference changes when theme === "system"
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