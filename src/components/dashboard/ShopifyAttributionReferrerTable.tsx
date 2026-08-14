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
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="pb-2 font-medium">Channel</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium">Referring URL</th>
              <th className="pb-2 font-medium">Orders</th>
              <th className="pb-2 font-medium">Sales</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="py-3 text-muted" colSpan={5}>
                  No referring URL rows.
                </td>
              </tr>
            ) : (
              rows.slice(0, 80).map((row) => (
                <tr
                  key={`${row.channel}-${row.type}-${row.referrerUrl}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-2.5 text-foreground">{row.channel}</td>
                  <td className="py-2.5 text-muted">{row.type}</td>
                  <td className="py-2.5 text-muted" title={row.referrerUrl}>
                    {truncateReferrer(row.referrerUrl, 72) || "(none)"}
                  </td>
                  <td className="py-2.5 text-muted">{formatNumber(row.orders)}</td>
                  <td className="py-2.5 text-muted">
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
