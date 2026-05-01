"use client";

import * as React from "react";
import { ColorMode, getTheme } from "../theme";

type ColorModeContextValue = {
  mode: ColorMode;
  toggle: () => void;
  setMode: (mode: ColorMode) => void;
};

const ColorModeContext = React.createContext<ColorModeContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "pks-color-mode";

export function useColorMode() {
  const ctx = React.useContext(ColorModeContext);
  if (!ctx) throw new Error("useColorMode must be used within ColorModeProvider");
  return ctx;
}

export function ColorModeProvider(props: { children: React.ReactNode }) {
  // Start in light to avoid SSR hydration mismatch, then hydrate from storage.
  const [mode, setModeState] = React.useState<ColorMode>("light");
  const [source, setSource] = React.useState<"system" | "user">("system");

  React.useEffect(() => {
    let mql: MediaQueryList | null = null;
    let onChange: ((e: MediaQueryListEvent) => void) | null = null;

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        setModeState(saved);
        setSource("user");
        return;
      }
      // Optional: respect OS preference if no saved value.
      mql = window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;
      const prefersDark = Boolean(mql?.matches);
      setModeState(prefersDark ? "dark" : "light");
      setSource("system");

      // Keep in sync with OS/browser changes as long as the user hasn't chosen explicitly.
      if (mql) {
        onChange = (e) => {
          setModeState(e.matches ? "dark" : "light");
        };
        mql.addEventListener("change", onChange);
      }
    } catch {
      // ignore
    }

    return () => {
      if (mql && onChange) {
        mql.removeEventListener("change", onChange);
      }
    };
  }, []);

  const setMode = React.useCallback((next: ColorMode) => {
    setModeState(next);
    setSource("user");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggle = React.useCallback(() => {
    setMode(mode === "light" ? "dark" : "light");
  }, [mode, setMode]);

  const value = React.useMemo(() => ({ mode, toggle, setMode }), [mode, toggle, setMode]);

  // Expose theme via context consumer; pages/_app uses getTheme(mode).
  // (We keep getTheme here for easy import in places that need it.)
  void getTheme;
  void source;

  return (
    <ColorModeContext.Provider value={value}>
      {props.children}
    </ColorModeContext.Provider>
  );
}


