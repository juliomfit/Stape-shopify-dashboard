import Link from "next/link";
import type { ShopifyOrder } from "@/lib/shopify/types";
import { clickIdLabel } from "@/lib/shopify/first-touch";
import { mismatchLabel, truncateReferrer } from "@/lib/shopify/journey";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { ChannelLabel } from "@/components/dashboard/ChannelMark";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";

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
  if (orders.length === 0) {
    return (
      <EmptyPanel
        title="Orders"
        description={
          connected
            ? "No Shopify orders in this date range."
            : "Orders will appear here after Shopify is connected."
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
        <table className="dash-table min-w-[72rem]">
          <thead>
            <tr>
              <th>Order</th>
              <th>Date</th>
              <th>First-touch</th>
              <th>Shopify first-click</th>
              <th>Campaign</th>
              <th>Click ID</th>
              <th className="num">Gross</th>
              <th className="num">Total</th>
              <th className="num">Fees</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const href = order.legacyId
                ? `/sales/${order.legacyId}`
                : undefined;

              return (
                <tr key={order.id}>
                  <td className="font-medium text-foreground">
                    {href ? (
                      <Link href={href} className="hover:text-accent">
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
                  <td className="text-muted">{formatDate(order.createdAt)}</td>
                  <td>
                    <ChannelLabel name={order.firstTouchChannel} />
                    {order.firstTouch.utmSource || order.firstTouch.utmMedium ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {[order.firstTouch.utmSource, order.firstTouch.utmMedium]
                          .filter(Boolean)
                          .join(" / ")}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {order.journey?.firstClick.label ? (
                      <ChannelLabel name={order.journey.firstClick.label} />
                    ) : (
                      "—"
                    )}
                    {order.journeyMismatch ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {mismatchLabel(order.journeyMismatch)}
                      </span>
                    ) : order.journey?.firstVisit?.referrerUrl ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {truncateReferrer(order.journey.firstVisit.referrerUrl, 40)}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-muted">
                    {order.firstTouch.utmCampaign || "—"}
                  </td>
                  <td className="num text-muted">
                    {clickIdLabel(order.firstTouch) || "—"}
                  </td>
                  <td className="num text-muted">{formatMoney(order.gross)}</td>
                  <td className="num text-foreground">{formatMoney(order.total)}</td>
                  <td className="num text-muted">
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
    </article>
  );
}
