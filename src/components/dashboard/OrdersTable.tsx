"use client";

import Link from "next/link";
import type { ShopifyOrder } from "@/lib/shopify/types";
import { clickIdLabel } from "@/lib/shopify/first-touch";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { ChannelLabel } from "@/components/dashboard/ChannelMark";
import { EmptyTable } from "@/components/dashboard/EmptyTable";
import { ShowMoreButton, useShowMore } from "@/components/dashboard/ShowMore";

type OrdersTableProps = {
  orders: ShopifyOrder[];
  periodLabel: string;
  connected?: boolean;
};

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OrdersTable({
  orders,
  periodLabel,
  connected = false,
}: OrdersTableProps) {
  const { visible, remaining, showMore } = useShowMore(orders);
  if (orders.length === 0) {
    return (
      <EmptyTable
        title="Orders"
        why={
          connected
            ? `No Shopify orders in ${periodLabel}. This is an empty day, not a broken table.`
            : "Orders will appear here after Shopify is connected."
        }
        next={
          connected
            ? [
                { kind: "range", range: "yesterday", label: "Yesterday" },
                { kind: "range", range: "7d", label: "7d" },
              ]
            : [{ kind: "href", href: "/integrations", label: "Integrations" }]
        }
      />
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">Orders</h2>
        <p className="mt-1 text-xs text-muted">
          First-touch from storefront gn_* cart attributes · {periodLabel}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-6 py-3 font-medium">Order</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">First-touch</th>
              <th className="px-6 py-3 font-medium">Campaign</th>
              <th className="px-6 py-3 font-medium">Click ID</th>
              <th className="px-6 py-3 text-right font-medium">Gross</th>
              <th className="px-6 py-3 text-right font-medium">Total</th>
              <th className="px-6 py-3 text-right font-medium">Fees</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((order) => {
              const href = order.legacyId
                ? `/sales/${order.legacyId}`
                : undefined;

              return (
                <tr key={order.id}>
                  <td className="px-6 py-3 font-medium text-foreground">
                    {href ? (
                      <Link prefetch={false} href={href} className="hover:text-accent">
                        {order.name}
                      </Link>
                    ) : (
                      order.name
                    )}
                    <span className="mt-0.5 block text-xs font-normal text-muted">
                      {formatStatus(order.financialStatus)} ·{" "}
                      {formatNumber(order.itemCount)} items
                    </span>
                  </td>
                  <td className="px-6 py-3 text-muted">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-6 py-3 text-foreground">
                    <ChannelLabel name={order.firstTouchChannel} />
                    {order.firstTouch.utmSource || order.firstTouch.utmMedium ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {[order.firstTouch.utmSource, order.firstTouch.utmMedium]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-3 text-muted">
                    {order.firstTouch.utmCampaign || "—"}
                  </td>
                  <td className="px-6 py-3 text-muted">
                    {clickIdLabel(order.firstTouch) || "—"}
                  </td>
                  <td className="px-6 py-3 text-right text-muted">
                    {formatMoney(order.gross)}
                  </td>
                  <td className="px-6 py-3 text-right text-foreground">
                    {formatMoney(order.total)}
                  </td>
                  <td className="px-6 py-3 text-right text-muted">
                    {order.processingFees
                      ? formatMoney(order.processingFees)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ShowMoreButton remaining={remaining} onMore={showMore} />
    </article>
  );
}
