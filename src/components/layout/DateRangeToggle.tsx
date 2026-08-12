"use client";

import { useRouter } from "next/navigation";
import { setDashboardRange } from "@/lib/period-actions";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/period";

type DateRangeToggleProps = {
  value: RangeKey;
};

export function DateRangeToggle({ value }: DateRangeToggleProps) {
  const router = useRouter();

  async function select(key: RangeKey) {
    await setDashboardRange(key);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap rounded-lg border border-border bg-background p-1">
      {RANGE_OPTIONS.map((option) => {
        const active = value === option.key;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              void select(option.key);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
