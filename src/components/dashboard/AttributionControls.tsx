"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ATTRIBUTION_MODEL_LABELS,
  ATTRIBUTION_MODELS,
  type AttributionModel,
} from "@/lib/attribution/engine";
import {
  ATTRIBUTION_WINDOW_DAYS,
  ATTRIBUTION_WINDOW_NOTE,
} from "@/lib/attribution/windows";

type AttributionControlsProps = {
  lookbackDays: number;
  model?: AttributionModel;
  showModel?: boolean;
};

export function AttributionControls({
  lookbackDays,
  model,
  showModel = false,
}: AttributionControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-end sm:justify-between">
      {showModel ? (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Attribution model
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            value={model}
            onChange={(event) => setParam("model", event.target.value)}
          >
            {ATTRIBUTION_MODELS.map((key) => (
              <option key={key} value={key}>
                {ATTRIBUTION_MODEL_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="flex flex-col gap-1 text-xs text-muted">
        Attribution window
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          value={String(lookbackDays)}
          onChange={(event) => setParam("lookback", event.target.value)}
        >
          {ATTRIBUTION_WINDOW_DAYS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
      </label>
      <p className="max-w-sm text-xs leading-5 text-muted">{ATTRIBUTION_WINDOW_NOTE}</p>
    </div>
  );
}
