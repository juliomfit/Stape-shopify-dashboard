"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Boxes,
  Database,
  Funnel,
  LayoutDashboard,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  Target,
  Users,
  Warehouse,
} from "lucide-react";
import { BrandMark } from "@/components/dashboard/BrandMark";
import { navGroups, type NavItem } from "@/lib/navigation";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ href }: { href: NavItem["href"] }) {
  const className = "h-4 w-4 shrink-0 opacity-80";
  switch (href) {
    case "/":
      return <LayoutDashboard className={className} />;
    case "/sales":
      return <Receipt className={className} />;
    case "/attribution":
      return <Target className={className} />;
    case "/shopify-attribution":
      return <ShoppingBag className={className} />;
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
    case "/data-quality":
      return <ShieldCheck className={className} />;
    default:
      return <Database className={className} />;
  }
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-4 py-5">
        <BrandMark size={32} />
        <div>
          <p className="text-sm font-semibold tracking-tight text-sidebar-active">
            Goodsnova
          </p>
          <p className="text-[11px] text-sidebar-foreground">Command center</p>
        </div>
      </div>

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
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
    </aside>
  );
}
