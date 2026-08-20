"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FRESHNESS_POLL_MS } from "@/lib/freshness/schedules";

type Compact = { status: string; label: string };

export function FreshnessBadge() {
  const router = useRouter();
  const [compact, setCompact] = useState<Compact | null>(null);

  useEffect(() => {
    let cancelled = false;
    let version = "";

    async function tick() {
      try {
        const response = await fetch("/api/freshness", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          version?: string;
          compact?: Compact;
        };
        if (cancelled) return;
        if (data.compact) setCompact(data.compact);
        if (version && data.version && data.version !== version) {
          router.refresh();
        }
        if (data.version) version = data.version;
      } catch {
        // Keep last-known compact label.
      }
    }

    void tick();
    const id = window.setInterval(() => void tick(), FRESHNESS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router]);

  if (!compact) return null;
  return (
    <p
      className="text-[11px] font-medium text-muted lg:text-xs"
      data-freshness-status={compact.status}
    >
      {compact.label}
    </p>
  );
}
