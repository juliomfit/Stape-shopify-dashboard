"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/windows";

type AttributionLookbackControlsProps = {
  lookbackDays: number;
};

export function AttributionLookbackControls({
  lookbackDays,
}: AttributionLookbackControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setLookback(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("lookback", value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface p-4 sm:max-w-xs">
      <label className="text-xs text-muted" htmlFor="attribution-lookback">
        Attribution window
      </label>
      <select
        id="attribution-lookback"
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        value={String(lookbackDays)}
        onChange={(event) => setLookback(event.target.value)}
      >
        {ATTRIBUTION_WINDOW_DAYS.map((days) => (
          <option key={days} value={days}>
            {days} days
          </option>
        ))}
      </select>
      <p className="text-xs leading-5 text-muted">
        Touches older than this many days before purchase are excluded. Does not
        change Shopify order totals.
      </p>
    </div>
  );
}
