import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { LtvCohortRow, LtvWindowDays } from "@/lib/shopify/ltv";
import { LTV_WINDOWS } from "@/lib/shopify/ltv";

type LtvTableProps = {
  rows: LtvCohortRow[];
  currencyCode: string;
  title?: string;
};

export function LtvTable({
  rows,
  currencyCode,
  title = "LTV by first-purchase cohort",
}: LtvTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Cohort = first Shopify purchase month (Pacific). Windows are cumulative
        net revenue from that first order. Immature windows are marked — not
        final LTV. Uses Shopify orders loaded for the header range (max 10k).
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          LTV appears once identified Shopify customers have orders in range.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[56rem]">
            <thead>
              <tr>
                <th>Cohort</th>
                <th className="num">Customers</th>
                <th className="num">First-order $</th>
                <th className="num">Repeat rate</th>
                {LTV_WINDOWS.map((days) => (
                  <th key={days} className="num">
                    {days}d LTV
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cohort}>
                  <td className="text-foreground">{row.cohort}</td>
                  <td className="num">{formatNumber(row.customers)}</td>
                  <td className="num">
                    {formatMoney({
                      amount: row.firstOrderRevenue,
                      currencyCode,
                    })}
                  </td>
                  <td className="num">{formatPercent(row.repeatRate)}</td>
                  {LTV_WINDOWS.map((days: LtvWindowDays) => (
                    <td key={days} className="num">
                      {formatMoney({
                        amount: row.ltv[days],
                        currencyCode,
                      })}
                      {row.mature[days] ? "" : " · immature"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
