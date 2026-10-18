"use client";

/**
 * Custom theme provider — replaces next-themes to fix the React 19 warning:
 *   "Encountered a script tag while rendering React component."
 *
 * next-themes injects an inline <script> for SSR theme detection.
 * React 19 hoists ALL <script> tags found inside components to <head> and
 * generates the console warning. Moving to a "use client" boundary did not
 * fully suppress it because React 19 still processes the script tag.
 *
 * This custom implementation:
 *  - Reads the stored theme from localStorage on mount (useEffect)
 *  - Sets the "dark" or "light" class on <html> directly — no <script> tag
 *  - Persists theme changes to localStorage
 *  - Exports useTheme() so existing consumers keep the same interface
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Toaster } from "@/components/ui/sonner";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolvedTheme: Theme;
}

const STORAGE_KEY = "newtonite-theme";
const DEFAULT_THEME: Theme = "dark";

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  resolvedTheme: DEFAULT_THEME,
});

/** Drop-in replacement for next-themes useTheme */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function Providers({ children }: { children: ReactNode }) {
  // Start with default theme; useEffect will read localStorage on mount
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // On mount: read persisted preference and apply class to <html>
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? DEFAULT_THEME;
    applyTheme(stored);
    setThemeState(stored);
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme: theme }}>
      {children}
      <Toaster position="top-right" />
    </ThemeContext.Provider>
  );
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(t);
}