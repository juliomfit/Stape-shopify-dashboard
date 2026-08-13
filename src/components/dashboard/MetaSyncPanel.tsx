"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearMetaPasteAction,
  disconnectMeta,
  saveAndSyncMeta,
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
  const [saveState, saveAction, saving] = useActionState(saveAndSyncMeta, idle);
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
        You do not need a Meta developer app. Copy totals from Ads Manager for{" "}
        <span className="font-medium text-foreground">
          {periodLabel} · {startDate} to {endDate}
        </span>
        . Use Pacific time so the day matches Shopify.
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
          Set the same dates as this dashboard ({startDate} to {endDate}).
        </li>
        <li>
          Copy Amount spent. Purchases and Purchase conversion value are
          optional (they only fill the platform-claimed columns).
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
      {pasteState.message ? (
        <p
          className={`mt-3 text-sm ${pasteState.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {pasteState.message}
        </p>
      ) : null}
      {syncMessage ? (
        <p
          className={`mt-3 text-sm ${syncOk ? "text-emerald-700" : "text-red-700"}`}
        >
          {syncMessage}
        </p>
      ) : null}

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Optional: auto-sync with a token (needs a Meta app)
        </summary>
        <p className="mt-2 text-xs leading-5 text-muted">
          Skip this if you cannot create a Business app. Paste above instead.
        </p>
        {connection.configured ? (
          <div className="mt-4 rounded-xl border border-border bg-background p-4">
            <p className="text-sm text-foreground">
              Connected · account {connection.adAccountId} · token{" "}
              {connection.tokenHint}
              {connection.source === "env" ? " (from .env.local)" : ""}
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
        ) : (
          <form action={saveAction} className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Ad account ID</span>
              <input
                name="adAccountId"
                autoComplete="off"
                placeholder="123456789012345"
                className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted">Access token</span>
              <input
                name="accessToken"
                type="password"
                autoComplete="off"
                placeholder="EAAxxxx…"
                className="rounded-lg border border-border bg-background px-3 py-2 text-foreground"
              />
            </label>
            <button
              type="submit"
              disabled={saving}
              className="w-fit rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground disabled:opacity-60"
            >
              {saving ? "Syncing…" : "Save and sync Meta"}
            </button>
            {saveState.message ? (
              <p
                className={`text-sm ${saveState.ok ? "text-emerald-700" : "text-red-700"}`}
              >
                {saveState.message}
              </p>
            ) : null}
          </form>
        )}
      </details>
    </article>
  );
}
