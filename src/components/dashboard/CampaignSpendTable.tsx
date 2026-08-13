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
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 font-medium">Campaign</th>
              <th className="pb-2 font-medium">Spend</th>
              <th className="pb-2 font-medium">gn_* orders</th>
              <th className="pb-2 font-medium">gn_* revenue</th>
              <th className="pb-2 font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.campaign} className="border-b border-border last:border-0">
                <td className="py-2.5 text-foreground">{row.campaign}</td>
                <td className="py-2.5 text-muted">
                  {formatMoney({ amount: row.spend, currencyCode })}
                </td>
                <td className="py-2.5 text-muted">
                  {formatNumber(row.shopifyOrders)}
                </td>
                <td className="py-2.5 text-muted">
                  {formatMoney({ amount: row.shopifyRevenue, currencyCode })}
                </td>
                <td className="py-2.5 text-muted">
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
