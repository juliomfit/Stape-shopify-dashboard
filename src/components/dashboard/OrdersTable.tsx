import type { ShopifyOrder } from "@/lib/shopify/types";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";

type OrdersTableProps = {
  orders: ShopifyOrder[];
  periodLabel: string;
};

function formatStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OrdersTable({ orders, periodLabel }: OrdersTableProps) {
  if (orders.length === 0) {
    return (
      <EmptyPanel
        title="Recent orders"
        description="Orders will appear here after Shopify is connected."
      />
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">Recent orders</h2>
        <p className="mt-1 text-xs text-muted">
          Last 25 orders · {periodLabel}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-6 py-3 font-medium">Order</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 text-right font-medium">Items</th>
              <th className="px-6 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-3 font-medium text-foreground">
                  {order.name}
                </td>
                <td className="px-6 py-3 text-muted">
                  {formatDate(order.createdAt)}
                </td>
                <td className="px-6 py-3 text-muted">
                  {formatStatus(order.financialStatus)}
                </td>
                <td className="px-6 py-3 text-right text-muted">
                  {formatNumber(order.itemCount)}
                </td>
                <td className="px-6 py-3 text-right text-foreground">
                  {formatMoney(order.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
