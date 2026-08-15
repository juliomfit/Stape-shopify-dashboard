import {
  Activity,
  DollarSign,
  MousePointerClick,
  Percent,
  ShoppingBag,
  Sparkles,
  Users,
} from "lucide-react";
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

function MetricIcon({ label }: { label: string }) {
  const className = "h-3.5 w-3.5";
  const text = label.toLowerCase();
  if (text.includes("revenue") || text.includes("sales") || text.includes("aov")) {
    return <DollarSign className={className} />;
  }
  if (text.includes("order")) {
    return <ShoppingBag className={className} />;
  }
  if (text.includes("session") || text.includes("traffic") || text.includes("pageview")) {
    return <Activity className={className} />;
  }
  if (text.includes("conversion") || text.includes("rate") || text.includes("mer")) {
    return <Percent className={className} />;
  }
  if (text.includes("user") || text.includes("customer")) {
    return <Users className={className} />;
  }
  if (text.includes("roas") || text.includes("spend") || text.includes("cpa")) {
    return <MousePointerClick className={className} />;
  }
  return <Sparkles className={className} />;
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
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted lg:text-xs">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent">
          <MetricIcon label={label} />
        </span>
        {label}
      </p>
      <p
        className={`mt-2 text-xl font-semibold tracking-tight lg:mt-3 lg:text-2xl ${
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
      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted">{source}</p>
    </article>
  );
}
