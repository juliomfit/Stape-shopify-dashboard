"use client";

import { useState } from "react";
import {
  ATTRIBUTION_MODEL_LABELS,
  type ModelComparison,
} from "@/lib/attribution/engine";
import { formatMoney, formatNumber } from "@/lib/format";

type ModelComparisonTableProps = {
  comparison: ModelComparison;
  currencyCode: string;
};

type Metric = "revenue" | "orders";

export function ModelComparisonTable({
  comparison,
  currencyCode,
}: ModelComparisonTableProps) {
  const [metric, setMetric] = useState<Metric>("revenue");

  const format = (value: number) =>
    metric === "revenue"
      ? formatMoney({ amount: value, currencyCode })
      : formatNumber(Math.round(value * 10) / 10);

  if (comparison.channels.length === 0) {
    return (
      <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">
          Attribution model comparison
        </h2>
        <p className="mt-2 text-sm text-muted">
          Attributed revenue per model appears here once Stape / BigQuery has
          stitched purchase journeys for the selected range.
        </p>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Attribution model comparison
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted">
            Same orders, credited by each first-party model. This is our
            attribution — independent of Meta/Google reported numbers.
          </p>
        </div>
        <div className="flex rounded-lg border border-border bg-background p-1">
          {(["revenue", "orders"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMetric(option)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                metric === option
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="dash-table min-w-[48rem]">
          <thead>
            <tr>
              <th>Channel</th>
              {comparison.models.map((model) => (
                <th key={model} className="num">
                  {ATTRIBUTION_MODEL_LABELS[model]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparison.channels.map((channel) => (
              <tr key={channel}>
                <td className="text-foreground">{channel}</td>
                {comparison.models.map((model) => {
                  const cell = comparison.cells[model]?.[channel];
                  return (
                    <td key={model} className="num">
                      {cell ? format(cell[metric]) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total attributed</td>
              {comparison.models.map((model) => (
                <td key={model} className="num">
                  {format(comparison.totalsByModel[model][metric])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}
