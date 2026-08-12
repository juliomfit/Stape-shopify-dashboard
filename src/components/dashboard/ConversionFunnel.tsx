import { formatNumber } from "@/lib/format";

type FunnelStep = {
  label: string;
  value: number;
  source: string;
};

type ConversionFunnelProps = {
  steps: FunnelStep[];
};

export function ConversionFunnel({ steps }: ConversionFunnelProps) {
  const max = Math.max(...steps.map((step) => step.value), 0);

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">Funnel</h2>
        <p className="text-xs text-muted">Last 30 days</p>
      </div>
      <ul className="mt-6 space-y-4">
        {steps.map((step) => {
          const width =
            max > 0 ? Math.max((step.value / max) * 100, step.value > 0 ? 4 : 0) : 0;

          return (
            <li key={step.label}>
              <div className="mb-1.5 flex items-center justify-between gap-4">
                <span className="text-sm text-foreground">{step.label}</span>
                <span className="text-sm text-muted">
                  {formatNumber(step.value)} · {step.source}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
