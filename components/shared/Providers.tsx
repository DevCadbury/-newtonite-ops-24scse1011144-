"use client";

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

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  resolvedTheme: "dark",
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function Providers({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    // On first visit (no stored preference), respect the OS preference
    const resolved: Theme = stored
      ? stored
      : window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
    applyTheme(resolved);
    setThemeState(resolved);
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
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(t);
}