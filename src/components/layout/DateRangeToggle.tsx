"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
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
  const [open, setOpen] = useState(period.key === "custom");
  const [customMode, setCustomMode] = useState(period.key === "custom");

  async function select(key: Exclude<RangeKey, "custom">) {
    setBusy(true);
    await setDashboardRange(key);
    router.refresh();
    setBusy(false);
    setCustomMode(false);
    setOpen(false);
  }

  async function applyCustom() {
    setBusy(true);
    await setDashboardCustomRange(from, to);
    router.refresh();
    setBusy(false);
  }

  const rangeLabel =
    period.key === "custom"
      ? period.displayRange
      : (RANGE_OPTIONS.find((option) => option.key === period.key)?.label ??
        period.label);

  return (
    <div className="flex w-full flex-col items-stretch gap-2 lg:w-auto lg:items-end">
      <button
        type="button"
        className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground lg:hidden"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
          {rangeLabel}
        </span>
        <span className="text-xs text-muted">{open ? "Hide" : "Change"}</span>
      </button>

      <div
        className={`${open ? "flex" : "hidden"} flex-col gap-2 lg:flex lg:items-end`}
      >
        <div className="hidden items-center justify-end gap-2 lg:flex">
          <Calendar className="h-4 w-4 text-muted" aria-hidden="true" />
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
        </div>

        <label className="grid gap-1 text-xs text-muted lg:hidden">
          Range
          <select
            className="min-h-11 rounded-xl border border-border bg-background px-3 text-base text-foreground"
            disabled={busy}
            value={customMode || period.key === "custom" ? "custom" : period.key}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "custom") {
                setCustomMode(true);
                setOpen(true);
                return;
              }
              void select(value as Exclude<RangeKey, "custom">);
            }}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom dates</option>
          </select>
        </label>

        <form
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end lg:justify-end"
          onSubmit={(event) => {
            event.preventDefault();
            void applyCustom();
          }}
        >
          <label className="grid flex-1 gap-1 text-xs text-muted lg:flex-none">
            From
            <input
              type="date"
              value={from}
              max={period.todayDate}
              onChange={(event) => {
                setFrom(event.target.value);
              }}
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-base text-foreground lg:min-h-0 lg:rounded-md lg:px-2 lg:py-1.5 lg:text-sm"
            />
          </label>
          <label className="grid flex-1 gap-1 text-xs text-muted lg:flex-none">
            To
            <input
              type="date"
              value={to}
              max={period.todayDate}
              onChange={(event) => {
                setTo(event.target.value);
              }}
              className="min-h-11 rounded-xl border border-border bg-background px-3 text-base text-foreground lg:min-h-0 lg:rounded-md lg:px-2 lg:py-1.5 lg:text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !from || !to}
            className={`min-h-11 rounded-xl px-3 text-sm font-medium disabled:opacity-60 lg:min-h-0 lg:rounded-md lg:py-1.5 ${
              period.key === "custom"
                ? "bg-foreground text-background"
                : "border border-border text-foreground"
            }`}
          >
            {busy ? "Updating…" : "Apply range"}
          </button>
        </form>
      </div>
      <p className="text-left text-xs leading-5 text-muted lg:max-w-md lg:text-right">
        {period.displayRange}
        {period.dayCount === 1 ? " · 1 day" : ` · ${period.dayCount} days`}
        {" · inclusive · "}
        {DASHBOARD_TZ.replace("_", " ")}
      </p>
    </div>
  );
}
