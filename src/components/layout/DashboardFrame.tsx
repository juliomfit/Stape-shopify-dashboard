"use client";

import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { MobileDrawer } from "@/components/layout/MobileDrawer";
import { NavProvider } from "@/components/layout/nav-context";
import { Sidebar } from "@/components/layout/Sidebar";

export function DashboardFrame({ children }: { children: ReactNode }) {
  return (
    <NavProvider>
      <div className="flex min-h-full">
        <Sidebar />
        <MobileDrawer />
        <main className="flex min-w-0 flex-1 flex-col overflow-x-hidden bg-background pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
        <BottomNav />
      </div>
    </NavProvider>
  );
}
