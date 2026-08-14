"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups } from "@/lib/navigation";

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <p className="text-sm font-semibold tracking-tight text-sidebar-active">
          Goodsnova
        </p>
        <p className="mt-0.5 text-xs text-sidebar-foreground">Analytics</p>
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
          </div>
        ))}
      </nav>
    </aside>
  );
}
