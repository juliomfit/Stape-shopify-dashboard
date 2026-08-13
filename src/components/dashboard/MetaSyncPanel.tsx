"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearMetaPasteAction,
  disconnectMeta,
  saveMetaCsvAction,
  saveMetaPasteAction,
  syncMetaSpend,
  type MetaSyncState,
} from "@/lib/ads/meta-actions";
import type { MetaConnectionPublic } from "@/lib/ads/meta-credentials";
import type { PeriodSpendPaste } from "@/lib/ads/spend-paste";

const idle: MetaSyncState = { ok: true, message: "" };

type MetaSyncPanelProps = {
  connection: MetaConnectionPublic;
  periodLabel: string;
  startDate: string;
  endDate: string;
  paste: PeriodSpendPaste | null;
};

function amountValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export function MetaSyncPanel({
  connection,
  periodLabel,
  startDate,
  endDate,
  paste,
}: MetaSyncPanelProps) {
  const router = useRouter();
  const [pasteState, pasteAction, pasting] = useActionState(
    saveMetaPasteAction,
    idle,
  );
  const [csvState, csvAction, importing] = useActionState(saveMetaCsvAction, idle);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncOk, setSyncOk] = useState(true);
  const [busy, setBusy] = useState(false);

  async function runSync() {
    setBusy(true);
    const result = await syncMetaSpend();
    setSyncOk(result.ok);
    setSyncMessage(result.message);
    setBusy(false);
    router.refresh();
  }

  async function runDisconnect() {
    setBusy(true);
    const result = await disconnectMeta();
    setSyncOk(result.ok);
    setSyncMessage(result.message);
    setBusy(false);
    router.refresh();
  }

  async function runClearPaste() {
    setBusy(true);
    const result = await clearMetaPasteAction();
    setSyncOk(result.ok);
    setSyncMessage(result.message);
    setBusy(false);
    router.refresh();
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Meta spend</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Facebook will not give this dashboard a login without a Meta app, and
        they will not let you create one. Copy totals from Ads Manager instead.
        No developer account. Match{" "}
        <span className="font-medium text-foreground">
          {periodLabel} · {startDate} to {endDate}
        </span>{" "}
        in Pacific time.
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
        <li>
          Open{" "}
          <a
            className="text-foreground underline"
            href="https://adsmanager.facebook.com/"
            target="_blank"
            rel="noreferrer"
          >
            Ads Manager
          </a>{" "}
          → Campaigns.
        </li>
        <li>
          Set the date picker to {startDate} through {endDate}.
        </li>
        <li>
          Type Amount spent below, or export CSV (Reports / Export) and upload
          it.
        </li>
      </ol>

      <form
        key={`${startDate}_${endDate}`}
        action={pasteAction}
        className="mt-5 grid gap-3 sm:grid-cols-3"
      >
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Amount spent</span>
          <input
            name="spend"
            inputMode="decimal"
            defaultValue={amountValue(paste?.spend)}
            placeholder="0.00"
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Purchases (optional)</span>
          <input
            name="purchases"
            inputMode="decimal"
            defaultValue={amountValue(paste?.purchases)}
            placeholder="—"
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Purchase value (optional)</span>
          <input
            name="revenue"
            inputMode="decimal"
            defaultValue={amountValue(paste?.revenue)}
            placeholder="—"
            className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-3">
          <button
            type="submit"
            disabled={pasting}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
          >
            {pasting ? "Saving…" : `Save Meta totals · ${periodLabel}`}
          </button>
          {paste ? (
            <button
              type="button"
              onClick={() => {
                void runClearPaste();
              }}
              disabled={busy}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted disabled:opacity-60"
            >
              Clear this range
            </button>
          ) : null}
        </div>
      </form>

      <form action={csvAction} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm">
          <span className="text-muted">Or upload Ads Manager CSV</span>
          <input
            name="csv"
            type="file"
            accept=".csv,text/csv"
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </label>
        <button
          type="submit"
          disabled={importing}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
        >
          {importing ? "Importing…" : "Import CSV"}
        </button>
      </form>

      {pasteState.message ? (
        <p
          className={`mt-3 text-sm ${pasteState.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {pasteState.message}
        </p>
      ) : null}
      {csvState.message ? (
        <p
          className={`mt-3 text-sm ${csvState.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {csvState.message}
        </p>
      ) : null}
      {syncMessage ? (
        <p
          className={`mt-3 text-sm ${syncOk ? "text-emerald-700" : "text-red-700"}`}
        >
          {syncMessage}
        </p>
      ) : null}

      {connection.configured ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-foreground">
            API token on file · account {connection.adAccountId} ·{" "}
            {connection.tokenHint}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void runSync();
              }}
              disabled={busy}
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
            >
              {busy ? "Syncing…" : `Sync Meta · ${periodLabel}`}
            </button>
            {connection.canDisconnect ? (
              <button
                type="button"
                onClick={() => {
                  void runDisconnect();
                }}
                disabled={busy}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted disabled:opacity-60"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
