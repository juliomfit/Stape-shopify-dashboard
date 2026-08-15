import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { MetaSyncPanel } from "@/components/dashboard/MetaSyncPanel";
import { RefreshControls } from "@/components/dashboard/RefreshControls";
import { getMetaConnectionPublic } from "@/lib/ads/meta-credentials";
import { getGooglePaste, getMetaPaste } from "@/lib/ads/spend-paste";
import { getSelectedPeriod } from "@/lib/period-server";
import { getBusinessContext } from "@/lib/platform/business-context";
import { addChangeLogForm, saveBusinessContextForm, pickMetaAdAccountAction } from "@/lib/platform/actions";
import { listChangeLog } from "@/lib/platform/change-log";
import { latestSync } from "@/lib/platform/sync-runs";
import { DASHBOARD_TZ } from "@/lib/period";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ meta?: string }>;
}) {
  const query = await searchParams;
  const period = await getSelectedPeriod();
  const [connection, metaPaste, googlePaste, business, changes, lastMeta] =
    await Promise.all([
      getMetaConnectionPublic(),
      getMetaPaste(period),
      getGooglePaste(period),
      getBusinessContext(),
      listChangeLog(),
      latestSync("meta"),
    ]);

  return (
    <>
      <Header
        title="Integrations"
        description={`Connect sources. Reporting timezone ${DASHBOARD_TZ}. Tokens stay server-side.`}
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        {query.meta === "connected" ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Meta connected. Press Refresh Meta to backfill insights.
          </p>
        ) : null}
        {query.meta === "pick" ? (
          <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-sm font-semibold">Pick a Meta ad account</h2>
            <ul className="mt-3 space-y-2">
              {connection.pendingAccounts.map((account) => (
                <li key={account.id}>
                  <form action={pickMetaAdAccountAction}>
                    <input type="hidden" name="adAccountId" value={account.id} />
                    <button
                      type="submit"
                      className="rounded-lg bg-foreground px-3 py-2 text-sm text-background"
                    >
                      {account.name} ({account.id})
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </article>
        ) : null}
        {query.meta === "error" ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
            Meta login failed. Check App ID, secret, redirect URI, and ads_read permission.
          </p>
        ) : null}

        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Meta Ads</h2>
          {connection.configured ? (
            <div className="mt-3 space-y-1 text-sm">
              <p>Connected ✓</p>
              <p>Account ID: {connection.adAccountId}</p>
              <p>Token: {connection.tokenHint}</p>
              <p>Last sync: {lastMeta?.completed_at || lastMeta?.started_at || "—"}</p>
              <p>Status: {lastMeta?.status || "not synced"}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Not connected</p>
          )}
        </article>

        <MetaSyncPanel
          connection={connection}
          periodLabel={period.label}
          startDate={period.startDate}
          endDate={period.endDate}
          paste={metaPaste}
          googlePaste={googlePaste}
        />
        <RefreshControls />

        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Business context (AI)</h2>
          <p className="mt-1 text-xs text-muted">
            Targets only. Leave COGS blank rather than guessing.
          </p>
          <form action={saveBusinessContextForm} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              Business
              <input name="business" defaultValue={business.business} className="rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Primary product
              <input name="primaryProduct" defaultValue={business.primaryProduct} className="rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Target CPA
              <input name="targetCpa" defaultValue={business.targetCpa ?? ""} className="rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Target MER
              <input name="targetMer" defaultValue={business.targetMer ?? ""} className="rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Typical COGS
              <input name="typicalCogs" defaultValue={business.typicalCogs ?? ""} className="rounded-lg border border-border px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              Currency
              <input name="currency" defaultValue={business.currency} className="rounded-lg border border-border px-3 py-2" />
            </label>
            <button type="submit" className="rounded-lg bg-foreground px-3 py-2 text-sm text-background sm:col-span-2">
              Save context
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Change log</h2>
          <form action={addChangeLogForm} className="mt-4 grid gap-3">
            <input name="title" placeholder="Creative launched" className="rounded-lg border border-border px-3 py-2 text-sm" required />
            <textarea name="description" placeholder="What changed" className="rounded-lg border border-border px-3 py-2 text-sm" />
            <input name="type" placeholder="creative | budget | gtm | offer" className="rounded-lg border border-border px-3 py-2 text-sm" />
            <button type="submit" className="w-fit rounded-lg border border-border px-3 py-2 text-sm">
              Add entry
            </button>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {changes.slice(0, 12).map((row) => (
              <li key={row.id}>
                <span className="text-muted">{row.timestamp.slice(0, 10)}</span> {row.title}
              </li>
            ))}
          </ul>
        </article>
      </section>
    </>
  );
}
