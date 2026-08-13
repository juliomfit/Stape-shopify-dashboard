"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LOOKBACK_DAYS,
  WAREHOUSE_MODELS,
  type WarehouseModel,
} from "@/lib/warehouse/constants";

type WarehouseControlsProps = {
  model: WarehouseModel;
  lookbackDays: number;
};

export function WarehouseControls({
  model,
  lookbackDays,
}: WarehouseControlsProps) {
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
      <label className="flex flex-col gap-1 text-xs text-muted">
        Attribution model
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          value={model}
          onChange={(event) => setParam("model", event.target.value)}
        >
          {WAREHOUSE_MODELS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Lookback window
        <select
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          value={String(lookbackDays)}
          onChange={(event) => setParam("lookback", event.target.value)}
        >
          {LOOKBACK_DAYS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
