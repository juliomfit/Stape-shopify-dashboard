import { Suspense } from "react";
import type { Metadata } from "next";
import { DataHealthStrip } from "@/components/dashboard/DataHealthStrip";
import { Header } from "@/components/layout/Header";
import { RefreshControls } from "@/components/dashboard/RefreshControls";
import { MetaIngestHealthPanel } from "@/components/dashboard/MetaIngestHealthPanel";
import { getDataHealth } from "@/lib/platform/health";
import { listSyncRuns } from "@/lib/platform/sync-runs";
import { syncRunDisplayStatus } from "@/lib/platform/sync-run-state";
import { EmptyTable } from "@/components/dashboard/EmptyTable";
import { loggedFallback } from "@/lib/observability/loader-log";
import { HealthReconciliation } from "./HealthReconciliation";

export const metadata: Metadata = { title: "Data health" };

export default async function HealthPage() {
  const [sources, runs] = await Promise.all([
    getDataHealth().catch(loggedFallback("health", [])),
    listSyncRuns().catch(loggedFallback("sync_runs", [])),
  ]);

  return (
    <>
      <Header
        title="Data health"
        description="Sync freshness and tracking reconciliation. Attribution numbers are not event-delivery coverage."
      />
      <section className="dash-page gap-6">
        <DataHealthStrip sources={sources} />
        <MetaIngestHealthPanel
          providerId={sources.find((source) => source.source === "meta")?.providerId || "none"}
          counts={
            sources.find((source) => source.source === "meta")?.factCounts ?? {
              available: false,
              campaigns: null,
              adsets: null,
              ads: null,
            }
          }
        />
        <RefreshControls />
        {runs.length === 0 ? (
          <EmptyTable
            title="No sync runs recorded"
            why="Refresh Meta writes sync_runs after Flyweel ingest. Charts never call Flyweel on page load."
            next={[{ kind: "href", href: "/meta", label: "Refresh Meta" }]}
          />
        ) : null}
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Recent sync runs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {runs.slice(0, 20).map((run) => (
              <li key={run.id}>
                {run.source} · {run.sync_type} · {syncRunDisplayStatus(run)} · {run.started_at}
                {run.error_message ? ` · ${run.error_message}` : ""}
              </li>
            ))}
          </ul>
        </article>
        <Suspense
          fallback={
            <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground">Tracking reconciliation</h2>
              <p className="mt-3 text-sm text-muted">Loading deeper capture comparisons…</p>
            </article>
          }
        >
          <HealthReconciliation />
        </Suspense>
      </section>
    </>
  );
}
