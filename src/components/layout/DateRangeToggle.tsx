"use client";

import { useRouter } from "next/navigation";
import { setDashboardRange } from "@/lib/period-actions";
import { RANGE_OPTIONS, type RangeDays } from "@/lib/period";

type DateRangeToggleProps = {
  value: RangeDays;
};

export function DateRangeToggle({ value }: DateRangeToggleProps) {
  const router = useRouter();

  async function select(days: RangeDays) {
    await setDashboardRange(days);
    router.refresh();
  }

  return (
    <div className="flex rounded-lg border border-border bg-background p-1">
      {RANGE_OPTIONS.map((days) => {
        const active = days === value;

        return (
          <button
            key={days}
            type="button"
            onClick={() => {
              void select(days);
            }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            {days}d
          </button>
        );
      })}
    </div>
  );
}
