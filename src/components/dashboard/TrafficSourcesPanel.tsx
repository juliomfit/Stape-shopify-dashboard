import type { TrafficSource } from "@/lib/stape/types";
import { formatNumber } from "@/lib/format";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";

type TrafficSourcesPanelProps = {
  sources: TrafficSource[];
};

export function TrafficSourcesPanel({ sources }: TrafficSourcesPanelProps) {
  if (sources.length === 0) {
    return (
      <EmptyPanel
        title="Traffic sources"
        description="Facebook, Google, and other first-party sources will appear here after Stape is writing to BigQuery."
      />
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">Traffic sources</h2>
        <p className="text-xs text-muted">
          First hit in each session · last 30 days
        </p>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {sources.map((item) => (
          <li
            key={item.source}
            className="flex items-center justify-between gap-4 py-3"
          >
            <span className="text-sm text-foreground">{item.source}</span>
            <span className="text-sm text-muted">
              {formatNumber(item.sessions)} sessions
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
