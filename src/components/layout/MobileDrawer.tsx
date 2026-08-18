"use client";

import { useEffect, useRef } from "react";
import { BrandMark } from "@/components/dashboard/BrandMark";
import { NavLinks } from "@/components/layout/NavLinks";
import { useNav } from "@/components/layout/nav-context";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function MobileDrawer() {
  const { open, setOpen } = useNav();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const first = panelRef.current?.querySelector("a, button");
    if (first instanceof HTMLElement) {
      first.focus();
    }
  }, [open]);

  return (
    <div className="lg:hidden">
      <div
        className={`fixed inset-0 z-40 bg-slate-950/50 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!open}
        onClick={() => setOpen(false)}
      />
      <div
        id="mobile-nav-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Goodsnova menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        inert={!open || undefined}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-5">
          <div className="flex items-center gap-3">
            <BrandMark size={32} />
            <div>
              <p className="text-sm font-semibold tracking-tight text-sidebar-active">
                Goodsnova
              </p>
              <p className="text-[11px] text-sidebar-foreground">Command center</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-sidebar-active"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <NavLinks onNavigate={() => setOpen(false)} />
        <div className="mt-auto border-t border-white/10 px-3 py-3">
          <ThemeToggle onToggle={() => setOpen(false)} />
        </div>
      </div>
    </div>
  );
}
