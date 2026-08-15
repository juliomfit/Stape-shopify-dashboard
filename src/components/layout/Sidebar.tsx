"use client";

import { BrandMark } from "@/components/dashboard/BrandMark";
import { NavLinks } from "@/components/layout/NavLinks";

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-white/5 bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3 px-4 py-5">
        <BrandMark size={32} />
        <div>
          <p className="text-sm font-semibold tracking-tight text-sidebar-active">
            Goodsnova
          </p>
          <p className="text-[11px] text-sidebar-foreground">Command center</p>
        </div>
      </div>
      <NavLinks />
    </aside>
  );
}
