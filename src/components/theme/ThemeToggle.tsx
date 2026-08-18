"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function setTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Ignore storage failures (private mode, etc.).
  }
  listeners.forEach((listener) => listener());
}

export function ThemeToggle({ onToggle }: { onToggle?: () => void }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(isDark ? "light" : "dark");
        onToggle?.();
      }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/5 hover:text-sidebar-active"
    >
      {isDark ? (
        <Sun className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
      )}
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}
