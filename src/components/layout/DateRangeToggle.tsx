"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  setDashboardCustomRange,
  setDashboardRange,
} from "@/lib/period-actions";
import {
  DASHBOARD_TZ,
  RANGE_OPTIONS,
  type DashboardPeriod,
  type RangeKey,
} from "@/lib/period";

type DateRangeToggleProps = {
  period: DashboardPeriod;
};

export function DateRangeToggle({ period }: DateRangeToggleProps) {
  const router = useRouter();
  const [from, setFrom] = useState(period.startDate);
  const [to, setTo] = useState(period.endDate);
  const [busy, setBusy] = useState(false);

  async function select(key: Exclude<RangeKey, "custom">) {
    setBusy(true);
    await setDashboardRange(key);
    router.refresh();
    setBusy(false);
  }

  async function applyCustom() {
    setBusy(true);
    await setDashboardCustomRange(from, to);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap justify-end rounded-lg border border-border bg-background p-1">
        {RANGE_OPTIONS.map((option) => {
          const active = period.key === option.key;

          return (
            <button
              key={option.key}
              type="button"
              disabled={busy}
              onClick={() => {
                void select(option.key);
              }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
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
      <form
        className="flex flex-wrap items-end justify-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void applyCustom();
        }}
      >
        <label className="grid gap-1 text-xs text-muted">
          From
          <input
            type="date"
            value={from}
            max={period.todayDate}
            onChange={(event) => {
              setFrom(event.target.value);
            }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted">
          To
          <input
            type="date"
            value={to}
            max={period.todayDate}
            onChange={(event) => {
              setTo(event.target.value);
            }}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !from || !to}
          className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${
            period.key === "custom"
              ? "bg-foreground text-background"
              : "border border-border text-foreground"
          }`}
        >
          {busy ? "Updating…" : "Apply range"}
        </button>
      </form>
      <p className="max-w-md text-right text-xs leading-5 text-muted">
        {period.displayRange}
        {period.dayCount === 1
          ? " · 1 day"
          : ` · ${period.dayCount} days`}
        {" · inclusive · "}
        {DASHBOARD_TZ.replace("_", " ")}
      </p>
    </div>
  );
}
