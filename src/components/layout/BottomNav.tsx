"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { NavIcon, isActivePath } from "@/components/layout/NavLinks";
import { useNav } from "@/components/layout/nav-context";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/sales", label: "Sales" },
  { href: "/attribution", label: "True" },
  { href: "/traffic", label: "Traffic" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { open, toggle } = useNav();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <NavIcon href={tab.href} className="h-5 w-5 opacity-100" />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="mobile-nav-drawer"
          className={`flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
            open ? "text-accent" : "text-muted"
          }`}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          More
        </button>
      </div>
    </nav>
  );
}
