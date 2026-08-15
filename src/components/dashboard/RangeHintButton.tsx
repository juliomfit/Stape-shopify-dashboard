"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setDashboardRange } from "@/lib/period-actions";

export function RangeHintButton({
  range,
  label,
}: {
  range: "7d" | "yesterday";
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent-soft disabled:opacity-60"
      onClick={() => {
        setBusy(true);
        void setDashboardRange(range).then(() => {
          router.refresh();
          setBusy(false);
        });
      }}
    >
      {busy ? "Updating…" : label}
    </button>
  );
}
