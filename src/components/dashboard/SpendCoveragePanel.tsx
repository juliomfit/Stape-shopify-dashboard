import { formatMoney, formatNumber } from "@/lib/format";
import type { SpendCoverageRow } from "@/lib/ads/spend-paste";

type SpendCoveragePanelProps = {
  rows: SpendCoverageRow[];
  currentStart: string;
  currentEnd: string;
};

export function SpendCoveragePanel({
  rows,
  currentStart,
  currentEnd,
}: SpendCoveragePanelProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Spend coverage</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Ranges with Meta or Google spend saved (paste, CSV, or API). The header
        range {currentStart}–{currentEnd} only uses a row that matches those
        dates.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No ad spend saved for any date range yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[28rem]">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Dates</th>
                <th className="num">Spend</th>
                <th>CSV grain</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const current =
                  row.startDate === currentStart && row.endDate === currentEnd;

                return (
                  <tr key={`${row.platform}-${row.startDate}-${row.endDate}`}>
                    <td className="text-foreground">
                      {row.platform === "facebook" ? "Meta" : "Google"}
                      {current ? (
                        <span className="ml-2 text-xs text-muted">this range</span>
                      ) : null}
                    </td>
                    <td className="text-muted">
                      {row.startDate} – {row.endDate}
                    </td>
                    <td className="num text-muted">
                      {row.spend === null
                        ? "—"
                        : formatMoney({ amount: row.spend, currencyCode: "USD" })}
                    </td>
                    <td className="text-muted">
                      {row.hasCampaignRows
                        ? "Campaign rows"
                        : "Account totals"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        {formatNumber(rows.length)} saved range
        {rows.length === 1 ? "" : "s"}.
      </p>
    </article>
  );
}
