import type { Anomaly } from "@/lib/platform/anomalies";
import { formatPercent } from "@/lib/format";

export function NeedsAttention({ anomalies }: { anomalies: Anomaly[] }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Needs attention</h2>
      {anomalies.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No deterministic alerts vs the previous equal-length Pacific window.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {anomalies.map((row) => (
            <li key={row.id} className="text-sm text-foreground">
              ⚠ {row.metric} {row.delta_percent === null ? "" : formatPercent(row.delta_percent)}{" "}
              <span className="text-muted">· {row.context}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
