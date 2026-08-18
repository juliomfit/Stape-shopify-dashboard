import { percentChange } from "@/lib/metrics/formulas";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { PlatformVsOurRow } from "@/lib/attribution/platform-compare";

export type { PlatformVsOurRow };

type PlatformVsOurTableProps = {
  rows: PlatformVsOurRow[];
  modelLabel: string;
  currencyCode: string;
};

function gapClass(gap: number | null) {
  if (gap === null) {
    return "text-muted";
  }
  // A positive gap = the platform claims more than our first-party attribution.
  return gap > 0.001 ? "text-negative" : gap < -0.001 ? "text-positive" : "text-muted";
}

export function PlatformVsOurTable({
  rows,
  modelLabel,
  currencyCode,
}: PlatformVsOurTableProps) {
  const hasAny = rows.some(
    (row) => row.platformRevenue !== null || row.ourRevenue > 0,
  );

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Platform-reported vs our attribution
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        What Meta/Google claim vs what our first-party engine credits them under{" "}
        <span className="font-medium text-foreground">{modelLabel}</span>. A
        positive gap means the platform is claiming more than our observed
        journeys support. Platform numbers are never treated as ground truth.
      </p>

      {!hasAny ? (
        <p className="mt-6 text-sm text-muted">
          Appears once ad-platform spend/conversions and first-party attributed
          orders are both present for this range.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[52rem]">
            <thead>
              <tr>
                <th>Channel</th>
                <th className="num">Spend</th>
                <th className="num">Platform purchases</th>
                <th className="num">Our orders</th>
                <th className="num">Platform revenue</th>
                <th className="num">Our revenue</th>
                <th className="num">Δ revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const gap =
                  row.platformRevenue === null || row.ourRevenue <= 0
                    ? null
                    : percentChange(row.platformRevenue, row.ourRevenue);
                return (
                  <tr key={row.channel}>
                    <td className="text-foreground">{row.channel}</td>
                    <td className="num">
                      {row.spend === null
                        ? "—"
                        : formatMoney({ amount: row.spend, currencyCode })}
                    </td>
                    <td className="num">
                      {row.platformPurchases === null
                        ? "—"
                        : formatNumber(row.platformPurchases)}
                    </td>
                    <td className="num">
                      {formatNumber(Math.round(row.ourOrders * 10) / 10)}
                    </td>
                    <td className="num">
                      {row.platformRevenue === null
                        ? "—"
                        : formatMoney({ amount: row.platformRevenue, currencyCode })}
                    </td>
                    <td className="num">
                      {formatMoney({ amount: row.ourRevenue, currencyCode })}
                    </td>
                    <td className={`num ${gapClass(gap)}`}>
                      {gap === null
                        ? "—"
                        : `${gap > 0 ? "+" : ""}${formatPercent(gap)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
