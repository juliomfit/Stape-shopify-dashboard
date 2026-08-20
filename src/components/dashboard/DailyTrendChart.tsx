"use client";

type DailyTrendChartProps = {
  title: string;
  description: string;
  days: string[];
  seriesA: { label: string; values: number[] };
  seriesB?: { label: string; values: number[] };
};

function pathFor(values: number[], width: number, height: number, max: number) {
  if (values.length === 0) {
    return "";
  }

  const step = values.length === 1 ? 0 : width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : index * step;
      const y = height - (max > 0 ? (value / max) * height : 0);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

export function DailyTrendChart({
  title,
  description,
  days,
  seriesA,
  seriesB,
}: DailyTrendChartProps) {
  const width = 640;
  const height = 160;
  const max = Math.max(...seriesA.values, ...(seriesB?.values ?? []), 0);

  if (days.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-6 text-sm text-muted">No daily series for this range.</p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-6 h-40 w-full"
        role="img"
        aria-label={
          seriesB
            ? `${seriesA.label} and ${seriesB.label} by Pacific day`
            : `${seriesA.label} by Pacific day`
        }
      >
        <path
          d={pathFor(seriesA.values, width, height, max)}
          fill="none"
          stroke="currentColor"
          className="text-accent"
          strokeWidth="2.5"
        />
        {seriesB ? (
          <path
            d={pathFor(seriesB.values, width, height, max)}
            fill="none"
            stroke="currentColor"
            className="text-slate-500"
            strokeWidth="2.5"
            strokeDasharray="5 4"
          />
        ) : null}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        <span>
          <span className="mr-1 inline-block h-2 w-4 rounded-sm bg-accent" />
          {seriesA.label}
        </span>
        {seriesB ? (
          <span>
            <span className="mr-1 inline-block h-2 w-4 rounded-sm bg-slate-500" />
            {seriesB.label}
          </span>
        ) : null}
        <span>
          {days[0]} → {days[days.length - 1]} · America/Los_Angeles
        </span>
      </div>
    </article>
  );
}
