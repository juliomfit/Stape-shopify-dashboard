import { ChannelLabel, TypeBadge } from "@/components/dashboard/ChannelMark";
import { formatMoney, formatNumber } from "@/lib/format";
import { truncateReferrer } from "@/lib/shopify/journey";
import type { ShopifyqlReferrerRow } from "@/lib/shopify/get-shopify-attribution";

type ShopifyAttributionReferrerTableProps = {
  rows: ShopifyqlReferrerRow[];
  currencyCode: string;
};

export function ShopifyAttributionReferrerTable({
  rows,
  currencyCode,
}: ShopifyAttributionReferrerTableProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">Referring URL</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Same Attribution model as the channel table. Self-referrals to
        goodsnova.com are treated as no external referrer on order journeys.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="dash-table min-w-[40rem]">
          <thead>
            <tr>
              <th>Channel</th>
              <th>Type</th>
              <th>Referring URL</th>
              <th className="num">Orders</th>
              <th className="num">Sales</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-muted" colSpan={5}>
                  No referring URL rows.
                </td>
              </tr>
            ) : (
              rows.slice(0, 80).map((row) => (
                <tr key={`${row.channel}-${row.type}-${row.referrerUrl}`}>
                  <td>
                    <ChannelLabel name={row.channel} type={row.type} />
                  </td>
                  <td>
                    <TypeBadge type={row.type} />
                  </td>
                  <td className="text-muted" title={row.referrerUrl}>
                    {truncateReferrer(row.referrerUrl, 72) || "(none)"}
                  </td>
                  <td className="num text-muted">{formatNumber(row.orders)}</td>
                  <td className="num text-muted">
                    {formatMoney({ amount: row.sales, currencyCode })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}
