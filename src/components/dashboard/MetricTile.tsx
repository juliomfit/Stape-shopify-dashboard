"use client";

import { formatPercent } from "@/lib/format";

export type SummaryMetric = {
  id: string;
  group: string;
  label: string;
  value: string | null;
  delta: number | null;
  spark?: number[];
  source: string;
  hero?: boolean;
  /** For metrics where a decrease is good (CPA, MER), flip delta coloring. */
  invertDelta?: boolean;
};

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) {
    return null;
  }

  const width = 96;
  const height = 28;
  const max = Math.max(...values, 0);
  const step = width / (values.length - 1);
  const d = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (max > 0 ? (value / max) * height : 0);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`mt-3 h-7 w-full ${positive ? "text-positive" : "text-accent"}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z" />
    </svg>
  );
}

type MetricTileProps = {
  metric: SummaryMetric;
  showDelta: boolean;
  pinned: boolean;
  onTogglePin: (id: string) => void;
};

export function MetricTile({
  metric,
  showDelta,
  pinned,
  onTogglePin,
}: MetricTileProps) {
  const { delta, invertDelta } = metric;
  const good = delta === null || delta === 0 ? null : delta > 0 !== Boolean(invertDelta);
  const deltaClass =
    good === null ? "text-muted" : good ? "text-positive" : "text-negative";
  const hasValue = Boolean(metric.value);

  return (
    <article className="group relative flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <button
        type="button"
        onClick={() => onTogglePin(metric.id)}
        aria-label={pinned ? `Unpin ${metric.label}` : `Pin ${metric.label}`}
        aria-pressed={pinned}
        className={`absolute right-3 top-3 rounded-md p-1 transition-colors ${
          pinned
            ? "text-accent"
            : "text-muted/40 hover:text-foreground group-hover:text-muted"
        }`}
      >
        <PinIcon filled={pinned} />
      </button>

      <p className="pr-6 text-sm font-medium text-muted">{metric.label}</p>
      <p
        className={`mt-3 font-semibold tracking-tight ${
          metric.hero ? "text-3xl" : "text-2xl"
        } ${hasValue ? "text-foreground" : "text-muted/50"}`}
      >
        {hasValue ? metric.value : "—"}
      </p>

      {showDelta && delta !== null ? (
        <p className={`mt-2 text-xs font-medium ${deltaClass}`}>
          {delta > 0 ? "▲ " : delta < 0 ? "▼ " : ""}
          {formatPercent(Math.abs(delta))} vs previous
        </p>
      ) : null}

      {metric.spark && metric.spark.length > 1 ? (
        <Sparkline values={metric.spark} positive={good !== false} />
      ) : null}

      <p className="mt-3 text-xs leading-4 text-muted">{metric.source}</p>
    </article>
  );
}
