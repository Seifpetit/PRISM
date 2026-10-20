"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { h } from "@/lib/h";

export type ThemePreference = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const dark = preference === "dark";
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("prism-theme");
    // System used to be selectable. Retain an existing user's explicit dark
    // choice, and migrate the old system value to the predictable light mode.
    const next: ThemePreference = stored === "dark" ? "dark" : "light";
    setPreferenceState(next);
    applyTheme(next);
  }, []);

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const value = useMemo(
    () => ({
      preference,
      setPreference: (next: ThemePreference) => {
        window.localStorage.setItem("prism-theme", next);
        setPreferenceState(next);
      },
    }),
    [preference],
  );

  return h(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function ThemeControl() {
  const { preference, setPreference } = useTheme();
  const dark = preference === "dark";
  return h(
    "button",
    {
      type: "button",
      onClick: () => setPreference(dark ? "light" : "dark"),
      className:
        "theme-icon-button grid h-9 w-9 place-items-center rounded-full border " +
        "border-border-default bg-bg-input text-muted focus-visible:outline-none " +
        "focus-visible:ring-2 focus-visible:ring-lineage",
      role: "switch",
      "aria-checked": dark,
      "aria-label": `Switch to ${dark ? "light" : "dark"} mode`,
      title: `Switch to ${dark ? "light" : "dark"} mode`,
    },
    dark
      ? h(Moon, { size: 16, "aria-hidden": true })
      : h(Sun, { size: 16, "aria-hidden": true }),
  );
}
