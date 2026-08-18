import { formatMoney, formatNumber } from "@/lib/format";
import type { CustomerCohortRow } from "@/lib/shopify/cohorts";

type CustomerCohortTableProps = {
  rows: CustomerCohortRow[];
  currencyCode: string;
  periodLabel: string;
};

export function CustomerCohortTable({
  rows,
  currencyCode,
  periodLabel,
}: CustomerCohortTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">
        Customer cohorts
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Cohort = Shopify customer createdAt month (Pacific). Revenue and orders
        are this header range ({periodLabel}), not lifetime LTV. True LTV needs
        lifetime spend, which this query does not fetch.
      </p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          Cohorts appear once Shopify customers with orders in this range are
          loaded.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="dash-table min-w-[40rem]">
            <thead>
              <tr>
                <th>Cohort</th>
                <th className="num">Customers</th>
                <th className="num">New</th>
                <th className="num">Orders in range</th>
                <th className="num">Revenue in range</th>
                <th className="num">Rev / customer</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.cohort}>
                  <td className="text-foreground">{row.cohort}</td>
                  <td className="num">{formatNumber(row.customers)}</td>
                  <td className="num">{formatNumber(row.newCustomers)}</td>
                  <td className="num">{formatNumber(row.orders)}</td>
                  <td className="num">
                    {formatMoney({ amount: row.revenue, currencyCode })}
                  </td>
                  <td className="num">
                    {formatMoney({
                      amount: row.avgRevenuePerCustomer,
                      currencyCode,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
