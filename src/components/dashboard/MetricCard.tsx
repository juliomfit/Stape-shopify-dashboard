type MetricCardProps = {
  label: string;
  source: string;
  value?: string | null;
};

export function MetricCard({ label, source, value }: MetricCardProps) {
  const hasValue = Boolean(value);

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
      <p className="mt-3 text-xs text-muted">{source}</p>
    </article>
  );
}
