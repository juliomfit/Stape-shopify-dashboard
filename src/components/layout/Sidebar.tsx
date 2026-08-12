"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/lib/navigation";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-sidebar text-sidebar-foreground">
      <div className="border-b border-white/10 px-6 py-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
          Analytics
        </p>
        <p className="mt-1 text-lg font-semibold text-sidebar-active">
          Shopify + Stape
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/10 text-sidebar-active"
                  : "text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-active"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
