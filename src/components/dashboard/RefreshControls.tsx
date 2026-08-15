"use client";

import { useState, useTransition } from "react";
import {
  backfillMetaAction,
  refreshSourceAction,
} from "@/lib/platform/actions";

export function RefreshControls() {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  function run(source: string) {
    start(async () => {
      setMessage("Refreshing…");
      const result = await refreshSourceAction(source);
      setMessage(result.message);
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Refresh data</h2>
      <p className="mt-1 text-xs text-muted">
        Uses the same importers as hourly cron. Overlapping Meta jobs are blocked.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["all", "Refresh all"],
          ["meta", "Refresh Meta"],
          ["shopify", "Refresh Shopify"],
          ["google_ads", "Refresh Google Ads"],
          ["ga4", "Refresh GA4"],
        ].map(([source, label]) => (
          <button
            key={source}
            type="button"
            disabled={pending}
            onClick={() => run(source)}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          start(async () => {
            setMessage("Backfilling Meta…");
            const result = await backfillMetaAction(startDate, endDate);
            setMessage(result.message);
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Backfill start</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Backfill end</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
            required
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          Backfill Meta
        </button>
      </form>
      {message ? <p className="mt-3 text-sm text-muted">{message}</p> : null}
    </article>
  );
}
