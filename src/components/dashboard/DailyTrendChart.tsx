"use client";

type Series = { label: string; values: number[]; dashed?: boolean };

type DailyTrendChartProps = {
  title: string;
  description: string;
  days: string[];
  seriesA: { label: string; values: number[] };
  seriesB?: { label: string; values: number[] };
  extraSeries?: Series[];
};

function pathFor(
  values: number[],
  width: number,
  height: number,
  max: number,
  padLeft: number,
) {
  if (values.length === 0) {
    return "";
  }

  const inner = width - padLeft;
  const step = values.length === 1 ? 0 : inner / (values.length - 1);
  return values
    .map((value, index) => {
      const x = padLeft + (values.length === 1 ? inner / 2 : index * step);
      const y = height - (max > 0 ? (value / max) * height : 0);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

const COLORS = ["#2563eb", "#64748b", "#7c3aed", "#0d9488", "#ea580c", "#db2777"];

export function DailyTrendChart({
  title,
  description,
  days,
  seriesA,
  seriesB,
  extraSeries = [],
}: DailyTrendChartProps) {
  const width = 640;
  const height = 168;
  const padLeft = 36;
  const series: Series[] = [
    { label: seriesA.label, values: seriesA.values },
    ...(seriesB ? [{ label: seriesB.label, values: seriesB.values, dashed: true }] : []),
    ...extraSeries,
  ];
  const max = Math.max(...series.flatMap((item) => item.values), 0);
  const lastA = seriesA.values[seriesA.values.length - 1];

  if (days.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-6 text-sm text-muted">No series for this range.</p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">{description}</p>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-5 h-44 w-full"
        role="img"
        aria-label={series.map((item) => item.label).join(" and ")}
      >
        <text x="0" y="12" className="fill-slate-400" fontSize="10">
          {max > 0 ? Math.round(max).toLocaleString() : "0"}
        </text>
        <text x="0" y={height - 2} className="fill-slate-400" fontSize="10">
          0
        </text>
        <line
          x1={padLeft}
          x2={width}
          y1={height}
          y2={height}
          className="stroke-slate-200"
          strokeWidth="1"
        />
        {series.map((item, index) => (
          <path
            key={item.label}
            d={pathFor(item.values, width, height, max, padLeft)}
            fill="none"
            stroke={COLORS[index % COLORS.length]}
            strokeWidth="2.25"
            strokeDasharray={item.dashed ? "5 4" : undefined}
          />
        ))}
        {typeof lastA === "number" ? (
          <text
            x={width}
            y={Math.max(
              12,
              height - (max > 0 ? (lastA / max) * height : 0) - 4,
            )}
            textAnchor="end"
            className="fill-slate-600"
            fontSize="10"
          >
            {Math.round(lastA).toLocaleString()}
          </text>
        ) : null}
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((item, index) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-4 rounded-sm"
              style={{ background: COLORS[index % COLORS.length] }}
            />
            {item.label}
          </span>
        ))}
        <span>
          {days[0]} → {days[days.length - 1]}
        </span>
      </div>
    </article>
  );
}
