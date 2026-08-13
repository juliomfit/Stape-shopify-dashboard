"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  disconnectMeta,
  saveAndSyncMeta,
  syncMetaSpend,
  type MetaSyncState,
} from "@/lib/ads/meta-actions";
import type { MetaConnectionPublic } from "@/lib/ads/meta-credentials";

const idle: MetaSyncState = { ok: true, message: "" };

type MetaSyncPanelProps = {
  connection: MetaConnectionPublic;
  periodLabel: string;
};

export function MetaSyncPanel({ connection, periodLabel }: MetaSyncPanelProps) {
  const router = useRouter();
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

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Sync Meta spend</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        One-time setup, then press Sync. Pulls Ads Manager spend for{" "}
        <span className="font-medium text-foreground">{periodLabel}</span>.
        Facebook has no public one-click login for a localhost dashboard — a
        system-user token is the durable way.
      </p>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
        <li>
          If you do not already have a Meta app:{" "}
          <a
            className="text-foreground underline"
            href="https://developers.facebook.com/apps/"
            target="_blank"
            rel="noreferrer"
          >
            developers.facebook.com/apps
          </a>{" "}
          → Create app → Business → add the Marketing API product. Development
          mode is enough.
        </li>
        <li>
          Open{" "}
          <a
            className="text-foreground underline"
            href="https://business.facebook.com/settings/system-users"
            target="_blank"
            rel="noreferrer"
          >
            Business settings → System users
          </a>
          . Create one named Goodsnova dashboard (Admin).
        </li>
        <li>Add assets → your ad account → at least View performance.</li>
        <li>
          Generate token. Choose that app. Permission:{" "}
          <code className="text-foreground">ads_read</code>. Copy the token.
        </li>
        <li>
          Ad account ID is in Ads Manager (top left). Numbers only. You can
          leave off <code className="text-foreground">act_</code>.
        </li>
      </ol>

      {connection.configured ? (
        <div className="mt-5 rounded-xl border border-border bg-background p-4">
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
          {syncMessage ? (
            <p
              className={`mt-3 text-sm ${syncOk ? "text-emerald-700" : "text-red-700"}`}
            >
              {syncMessage}
            </p>
          ) : null}
        </div>
      ) : (
        <form action={saveAction} className="mt-5 grid gap-3">
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
            className="w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-60"
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
    </article>
  );
}
