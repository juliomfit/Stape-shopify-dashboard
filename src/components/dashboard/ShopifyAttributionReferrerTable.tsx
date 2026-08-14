import { ChannelLabel, TypeBadge } from "@/components/dashboard/ChannelMark";
import { formatMoney, formatNumber } from "@/lib/format";
import { truncateReferrer } from "@/lib/shopify/journey";
import type { ShopifyqlReferrerRow } from "@/lib/shopify/get-shopify-attribution";
import {
  StackList,
  StackRow,
  TableOrCards,
} from "@/components/dashboard/TableOrCards";

type ShopifyAttributionReferrerTableProps = {
  rows: ShopifyqlReferrerRow[];
  currencyCode: string;
};

export function ShopifyAttributionReferrerTable({
  rows,
  currencyCode,
}: ShopifyAttributionReferrerTableProps) {
  const visible = rows.slice(0, 80);
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">Referring URL</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Same Attribution model as the channel table. Self-referrals to
        goodsnova.com are treated as no external referrer on order journeys.
      </p>
      <div className="mt-4">
        <TableOrCards
          cards={
            visible.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No referring URL rows.</p>
            ) : (
              <StackList>
                {visible.map((row) => (
                  <StackRow key={`${row.channel}-${row.type}-${row.referrerUrl}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <ChannelLabel name={row.channel} type={row.type} />
                        <p className="mt-1 truncate text-xs text-muted">
                          {truncateReferrer(row.referrerUrl, 48) || "(none)"}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatMoney({ amount: row.sales, currencyCode })}
                      </span>
                    </div>
                  </StackRow>
                ))}
              </StackList>
            )
          }
          table={
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
                {visible.length === 0 ? (
                  <tr>
                    <td className="text-muted" colSpan={5}>
                      No referring URL rows.
                    </td>
                  </tr>
                ) : (
                  visible.map((row) => (
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
          }
        />
      </div>
    </article>
  );
}
