import { formatMoney, formatNumber } from "@/lib/format";
import type { CampaignSpendCompare } from "@/lib/dashboard/true-performance";

type CampaignSpendTableProps = {
  rows: CampaignSpendCompare[];
  currencyCode: string;
  periodLabel: string;
};

export function CampaignSpendTable({
  rows,
  currencyCode,
  periodLabel,
}: CampaignSpendTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Campaign spend vs gn_utm_campaign
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        CSV campaign rows for {periodLabel} matched to Shopify first-touch
        campaign names. Names that do not match still show spend; ROAS stays —
        until they match.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="dash-table min-w-[32rem]">
          <thead>
            <tr>
              <th>Campaign</th>
              <th className="num">Spend</th>
              <th className="num">gn_* orders</th>
              <th className="num">gn_* revenue</th>
              <th className="num">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.campaign}>
                <td className="text-foreground">{row.campaign}</td>
                <td className="num text-muted">
                  {formatMoney({ amount: row.spend, currencyCode })}
                </td>
                <td className="num text-muted">
                  {formatNumber(row.shopifyOrders)}
                </td>
                <td className="num text-muted">
                  {formatMoney({ amount: row.shopifyRevenue, currencyCode })}
                </td>
                <td className="num text-muted">
                  {row.roas === null ? "—" : `${row.roas.toFixed(2)}x`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
