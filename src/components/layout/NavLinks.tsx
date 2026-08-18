"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  Database,
  Funnel,
  Gauge,
  Images,
  LayoutDashboard,
  Megaphone,
  Plug,
  Receipt,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Users,
  Warehouse,
} from "lucide-react";
import { navGroups, type NavItem } from "@/lib/navigation";
import { useNav } from "@/components/layout/nav-context";

export function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  if (href === "/meta") {
    return pathname === "/meta" || /^\/meta\/(?!creatives)/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavIcon({
  href,
  className = "h-4 w-4 shrink-0 opacity-80",
}: {
  href: NavItem["href"];
  className?: string;
}) {
  switch (href) {
    case "/summary":
      return <Gauge className={className} />;
    case "/":
      return <LayoutDashboard className={className} />;
    case "/sales":
      return <Receipt className={className} />;
    case "/meta":
      return <Megaphone className={className} />;
    case "/meta/creatives":
      return <Images className={className} />;
    case "/attribution":
      return <Target className={className} />;
    case "/traffic":
      return <Activity className={className} />;
    case "/conversions":
      return <Funnel className={className} />;
    case "/warehouse":
      return <Warehouse className={className} />;
    case "/products":
      return <Boxes className={className} />;
    case "/customers":
      return <Users className={className} />;
    case "/health":
      return <Stethoscope className={className} />;
    case "/data-quality":
      return <ShieldCheck className={className} />;
    case "/integrations":
      return <Plug className={className} />;
    case "/ai":
      return <Sparkles className={className} />;
    default:
      return <Database className={className} />;
  }
}

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-5 px-3 pb-6">
      {navGroups.map((group) => (
        <div key={group.label ?? "primary"} className="flex flex-col gap-0.5">
          {group.label ? (
            <p className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/70">
              {group.label}
            </p>
          ) : null}
          {group.items.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/10 text-sidebar-active shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                    : "text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-active"
                }`}
              >
                <NavIcon href={item.href} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function MenuButton() {
  const { open, toggle } = useNav();

  return (
    <button
      type="button"
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-background text-foreground lg:hidden"
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="mobile-nav-drawer"
      onClick={toggle}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        {open ? (
          <path d="M6 6l12 12M18 6L6 18" />
        ) : (
          <>
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </>
        )}
      </svg>
    </button>
  );
}
