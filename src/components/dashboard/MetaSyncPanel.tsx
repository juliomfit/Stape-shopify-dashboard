"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearMetaPasteAction,
  disconnectMeta,
  saveAndSyncMeta,
  saveMetaPasteAction,
  selectMetaAdAccount,
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
  oauthStatus?: string;
  oauthReason?: string;
};

function amountValue(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function oauthMessage(status?: string, reason?: string) {
  if (status === "connected") {
    return {
      ok: true,
      text: "Facebook connected. Spend will sync for this date range.",
    };
  }
  if (status === "pick") {
    return { ok: true, text: "Pick the ad account to use." };
  }
  if (status !== "error") {
    return null;
  }
  if (reason === "missing_app") {
    return {
      ok: false,
      text: "Add META_APP_ID and META_APP_SECRET to .env.local, then restart.",
    };
  }
  if (reason === "login_state") {
    return {
      ok: false,
      text: "Facebook login expired. Press Log in with Facebook again.",
    };
  }
  if (reason === "no_ad_accounts") {
    return {
      ok: false,
      text: "That Facebook user has no ad accounts. Log in as the user who runs Ads Manager.",
    };
  }
  return { ok: false, text: reason || "Facebook login failed." };
}

export function MetaSyncPanel({
  connection,
  periodLabel,
  startDate,
  endDate,
  paste,
  oauthStatus,
  oauthReason,
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
  const loginNotice = oauthMessage(oauthStatus, oauthReason);

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
        Competitor apps log you into{" "}
        <span className="font-medium text-foreground">their</span> Meta app.
        This dashboard can do the same after a one-time App ID (like Shopify).
        That is not a Business Manager account.
      </p>

      {connection.oauthReady && !connection.configured ? (
        <a
          href="/api/meta/connect"
          className="mt-4 inline-flex w-fit rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Log in with Facebook
        </a>
      ) : null}

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
            {connection.oauthReady ? (
              <a
                href="/api/meta/connect"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted"
              >
                Reconnect
              </a>
            ) : null}
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

      {connection.pendingAccounts.length > 0 ? (
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <p className="text-sm text-foreground">Choose an ad account</p>
          <div className="mt-3 flex flex-col gap-2">
            {connection.pendingAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    const result = await selectMetaAdAccount(account.id);
                    setSyncOk(result.ok);
                    setSyncMessage(result.message);
                    setBusy(false);
                    router.refresh();
                  })();
                }}
                className="rounded-lg border border-border px-3 py-2 text-left text-sm text-foreground"
              >
                {account.name} · {account.id}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loginNotice ? (
        <p
          className={`mt-3 text-sm ${loginNotice.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {loginNotice.text}
        </p>
      ) : null}

      {!connection.oauthReady && !connection.configured ? (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted">
          <li>
            Open{" "}
            <a
              className="text-foreground underline"
              href="https://developers.facebook.com/apps/"
              target="_blank"
              rel="noreferrer"
            >
              developers.facebook.com/apps
            </a>{" "}
            → Create app → <span className="text-foreground">Other</span> (not
            Business). Add Facebook Login.
          </li>
          <li>
            Facebook Login → Settings → Valid OAuth Redirect URI:{" "}
            <code className="text-foreground">
              http://localhost:3000/api/meta/callback
            </code>
          </li>
          <li>
            Settings → Basic → copy App ID and App Secret into{" "}
            <code className="text-foreground">.env.local</code> as{" "}
            <code className="text-foreground">META_APP_ID</code> and{" "}
            <code className="text-foreground">META_APP_SECRET</code>. Restart{" "}
            <code className="text-foreground">npm run dev</code>. Then this
            page shows Log in with Facebook.
          </li>
        </ol>
      ) : null}

      <details className="mt-6" open={!connection.configured}>
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Or paste Ads Manager totals for {periodLabel}
        </summary>
        <p className="mt-2 text-xs leading-5 text-muted">
          Use Pacific time so the day matches Shopify ({startDate} to {endDate}
          ).
        </p>
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
      </details>
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

      {!connection.configured ? (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Optional: paste a token instead of logging in
          </summary>
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
        </details>
      ) : null}
    </article>
  );
}
