"use client";

import { useState, type ReactNode } from "react";

export function MetricReveal({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`${open ? "flex" : "hidden"} flex-col gap-5 lg:flex`}>
        {children}
      </div>
      <button
        type="button"
        className="min-h-11 rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground lg:hidden"
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Show fewer metrics" : "More metrics"}
      </button>
    </>
  );
}
