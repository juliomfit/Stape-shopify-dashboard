import type { TrackingField } from "@/lib/stape/attribution-types";

type TrackingHealthProps = {
  fields: TrackingField[];
};

export function TrackingHealth({ fields }: TrackingHealthProps) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Tracking health</h2>
      <p className="mt-1 text-xs text-muted">
        How complete Stape events are in BigQuery for this date range
      </p>
      <ul className="mt-4 divide-y divide-border">
        {fields.map((field) => {
          const percent =
            field.total > 0 ? Math.round((field.filled / field.total) * 100) : 0;

          return (
            <li
              key={field.label}
              className="flex items-center justify-between gap-4 py-3"
            >
              <span className="text-sm text-foreground">
                {field.label}
                {field.needed ? (
                  <span className="ml-2 text-xs text-muted">needed</span>
                ) : null}
              </span>
              <span
                className={`text-sm ${
                  percent === 0 && field.needed ? "text-red-600" : "text-muted"
                }`}
              >
                {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
