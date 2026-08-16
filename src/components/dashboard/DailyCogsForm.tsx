"use client";

import { useState, useTransition } from "react";
import { saveCogsDayForm } from "@/lib/platform/actions";
import type { CogsLedgerRow } from "@/lib/platform/cogs-ledger";

type Props = {
  defaultDate: string;
  recent: CogsLedgerRow[];
  currencyCode?: string;
  compact?: boolean;
};

export function DailyCogsForm({
  defaultDate,
  recent,
  currencyCode = "USD",
  compact = false,
}: Props) {
  const [date, setDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function editRow(row: CogsLedgerRow) {
    setDate(row.date);
    setAmount(String(row.amount));
    setNote(row.note ?? "");
    setMessage(null);
  }

  return (
    <article
      className={
        compact
          ? "rounded-2xl border border-border bg-surface p-4 shadow-sm"
          : "rounded-2xl border border-border bg-surface p-6 shadow-sm"
      }
    >
      <h2 className="text-sm font-semibold text-foreground">Daily COGS</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        One supplier dollar total per Pacific day. Saving a date replaces that
        day. Missing days stay — not $0. Typical COGS on Integrations is a
        target only and is never copied here.
      </p>
      <form
        className={`mt-4 grid gap-3 ${compact ? "" : "sm:grid-cols-4"}`}
        action={(formData) => {
          startTransition(async () => {
            const result = await saveCogsDayForm(formData);
            setMessage(result.ok ? `Saved ${result.row.date}.` : result.message);
          });
        }}
      >
        <label className="grid gap-1 text-sm">
          Date
          <input
            name="date"
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Amount ({currencyCode})
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>
        <label className={`grid gap-1 text-sm ${compact ? "" : "sm:col-span-2"}`}>
          Note
          <input
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional"
            className="rounded-lg border border-border px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-lg bg-foreground px-3 py-2 text-sm text-background"
        >
          {pending ? "Saving…" : "Save COGS"}
        </button>
      </form>
      {message ? <p className="mt-2 text-xs text-muted">{message}</p> : null}
      {recent.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {recent.map((row) => (
            <li key={row.date} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-medium">{row.date}</span>
                {" · "}
                {currencyCode} {row.amount.toFixed(2)}
                {row.note ? ` · ${row.note}` : ""}
              </span>
              <button
                type="button"
                className="text-xs underline"
                onClick={() => editRow(row)}
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted">No days entered yet.</p>
      )}
    </article>
  );
}
