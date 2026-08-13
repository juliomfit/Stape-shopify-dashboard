import { formatPercent } from "@/lib/format";

type MetricCardProps = {
  label: string;
  source: string;
  value?: string | null;
  delta?: number | null;
  deltaLabel?: string;
  sparkline?: number[];
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return null;
  }

  const width = 88;
  const height = 24;
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
      className="mt-3 h-6 w-24 text-accent"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function MetricCard({
  label,
  source,
  value,
  delta = null,
  deltaLabel = "vs previous equal-length range",
  sparkline,
}: MetricCardProps) {
  const hasValue = Boolean(value);
  const deltaClass =
    delta === null
      ? "text-muted"
      : delta > 0
        ? "text-emerald-700"
        : delta < 0
          ? "text-red-700"
          : "text-muted";

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p
        className={`mt-5 text-3xl font-semibold tracking-tight ${
          hasValue ? "text-foreground" : "text-slate-300"
        }`}
      >
        {hasValue ? value : "—"}
      </p>
      {delta !== null ? (
        <p className={`mt-2 text-xs ${deltaClass}`}>
          {delta > 0 ? "+" : ""}
          {formatPercent(delta)} {deltaLabel}
        </p>
      ) : null}
      {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} /> : null}
      <p className="mt-3 text-xs text-muted">{source}</p>
    </article>
  );
}
