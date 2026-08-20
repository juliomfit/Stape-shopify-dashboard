"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshMetaSyncUiMessage } from "@/lib/platform/sync-run-state";

export function RefreshControls() {
  const router = useRouter();
  const inFlight = useRef(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  async function post(payload: Record<string, string>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage(
      payload.source === "meta" || payload.startDate ? "Updating…" : "Refreshing…",
    );
    try {
      const response = await fetch("/api/meta/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await response.text();
      let parsed: { ok?: boolean; message?: string; error?: string } | null = null;
      try {
        parsed = raw ? (JSON.parse(raw) as NonNullable<typeof parsed>) : {};
      } catch {
        parsed = null;
      }
      const feedback = refreshMetaSyncUiMessage({
        status: response.status,
        ok: response.ok,
        parsed,
        raw,
      });
      setMessage(feedback.message);
      if (feedback.shouldRefresh) {
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync request failed.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm" aria-busy={pending}>
      <h2 className="text-sm font-semibold text-foreground">Refresh data</h2>
      <p className="mt-1 text-xs text-muted">
        Starts a background provider job and returns immediately. Keep using the dashboard while Meta/Shopify catch up.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["meta", "Refresh Meta"],
          ["shopify", "Refresh Shopify"],
          ["ga4", "Refresh GA4"],
          ["google_ads", "Refresh Google Ads"],
        ].map(([source, label]) => (
          <button
            key={source}
            type="button"
            disabled={pending}
            onClick={() => post({ source })}
            className="rounded-lg bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50 disabled:pointer-events-none"
          >
            {pending && source === "meta" ? "Updating…" : label}
          </button>
        ))}
      </div>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void post({ startDate, endDate });
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
            disabled={pending}
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
            disabled={pending}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
        >
          Backfill Meta
        </button>
      </form>
      {message ? <p className="mt-3 text-sm text-foreground">{message}</p> : null}
    </article>
  );
}
