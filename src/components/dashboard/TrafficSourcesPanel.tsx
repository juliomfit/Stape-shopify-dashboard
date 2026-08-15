import type { TrafficSource } from "@/lib/stape/types";
import { formatNumber } from "@/lib/format";
import { EmptyTable } from "@/components/dashboard/EmptyTable";

type TrafficSourcesPanelProps = {
  sources: TrafficSource[];
  periodLabel?: string;
  title?: string;
  description?: string;
};

export function TrafficSourcesPanel({
  sources,
  periodLabel = "Last 30 days",
  title = "Traffic sources",
  description,
}: TrafficSourcesPanelProps) {
  if (sources.length === 0) {
    return (
      <EmptyTable
        title={title}
        why={`No Stape sessions in ${periodLabel}. Same session definition as Overview. Check Data quality if other pages also show —.`}
        next={[
          { kind: "range", range: "7d", label: "7d" },
          { kind: "href", href: "/data-quality", label: "Data quality" },
          { kind: "href", href: "/", label: "Overview" },
        ]}
      />
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted">
          {description || `Stape first hit in each session · ${periodLabel} · not gn_* first-touch`}
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
