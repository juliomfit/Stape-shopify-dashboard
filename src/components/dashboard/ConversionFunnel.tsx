import { formatNumber, formatPercent } from "@/lib/format";
import type { FunnelStep } from "@/lib/stape/get-funnel-metrics";

type ConversionFunnelProps = {
  steps: FunnelStep[];
  periodLabel: string;
  showTable?: boolean;
  shopifyOrders?: number | null;
};

function ratio(count: number, base: number) {
  if (base <= 0) {
    return null;
  }

  // Funnel steps are not strictly nested (e.g. purchases are counted by
  // transaction_id, checkout by session), so a later step can exceed an
  // earlier one. Clamp to [0, 100%] so the funnel never shows > 100%.
  return Math.max(0, Math.min(count / base, 1));
}

function dropOff(count: number, previous: number) {
  if (previous <= 0) {
    return null;
  }

  // Never report a negative drop-off when a step grows vs the previous one.
  return Math.max(0, 1 - count / previous);
}

export function ConversionFunnel({
  steps,
  periodLabel,
  showTable = false,
  shopifyOrders = null,
}: ConversionFunnelProps) {
  if (steps.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Funnel</h2>
        <p className="mt-6 text-sm text-muted">
          Funnel steps will appear when Stape / BigQuery is connected.
        </p>
      </article>
    );
  }

  const max = Math.max(...steps.map((step) => step.count), 0);
  const sessions = steps[0]?.count ?? 0;

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-sm font-semibold text-foreground">Funnel</h2>
        <p className="text-xs text-muted">{periodLabel} · Stape</p>
      </div>
      <ul className="mt-6 space-y-4">
        {steps.map((step, index) => {
          const width =
            max > 0 ? Math.max((step.count / max) * 100, step.count > 0 ? 4 : 0) : 0;
          const previous = index === 0 ? null : steps[index - 1];
          const fromPrevious = previous ? ratio(step.count, previous.count) : null;
          const lost = previous ? dropOff(step.count, previous.count) : null;

          return (
            <li key={step.key}>
              <div className="mb-1.5 flex items-center justify-between gap-4">
                <span className="text-sm text-foreground">
                  {step.label}
                  {step.note ? (
                    <span className="mt-0.5 block text-xs text-muted">{step.note}</span>
                  ) : null}
                </span>
                <span className="text-right text-sm text-muted">
                  {formatNumber(step.count)}
                  {fromPrevious === null ? null : (
                    <span className="ml-2 text-xs">
                      {formatPercent(fromPrevious)} of previous
                      {lost === null ? null : ` · ${formatPercent(lost)} drop-off`}
                    </span>
                  )}
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
      {showTable ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="pb-2 font-medium">Step</th>
                <th className="pb-2 font-medium">Count</th>
                <th className="pb-2 font-medium">% of previous</th>
                <th className="pb-2 font-medium">Drop-off</th>
                <th className="pb-2 font-medium">% of sessions</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((step, index) => {
                const previous = index === 0 ? null : steps[index - 1];
                const fromPrevious = previous
                  ? ratio(step.count, previous.count)
                  : null;
                const lost = previous
                  ? dropOff(step.count, previous.count)
                  : null;
                const fromSessions = ratio(step.count, sessions);

                return (
                  <tr key={step.key} className="border-b border-border last:border-0">
                    <td className="py-2.5 text-foreground">{step.label}</td>
                    <td className="py-2.5 text-muted">{formatNumber(step.count)}</td>
                    <td className="py-2.5 text-muted">
                      {fromPrevious === null ? "—" : formatPercent(fromPrevious)}
                    </td>
                    <td className="py-2.5 text-muted">
                      {lost === null ? "—" : formatPercent(lost)}
                    </td>
                    <td className="py-2.5 text-muted">
                      {fromSessions === null ? "—" : formatPercent(fromSessions)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {shopifyOrders !== null ? (
        <p className="mt-4 text-xs leading-5 text-muted">
          Shopify orders in this range: {formatNumber(shopifyOrders)}. That is
          the sales count to compare with the last Stape step — not revenue
          estimated from sessions.
        </p>
      ) : null}
    </article>
  );
}
