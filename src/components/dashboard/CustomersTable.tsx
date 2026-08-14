import type { CustomerPerformance } from "@/lib/shopify/types";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";

type CustomersTableProps = {
  customers: CustomerPerformance[];
  periodLabel: string;
  connected?: boolean;
};

export function CustomersTable({
  customers,
  periodLabel,
  connected = false,
}: CustomersTableProps) {
  if (customers.length === 0) {
    return (
      <EmptyPanel
        title="Customers"
        description={
          connected
            ? "No customers with orders in this date range."
            : "Customer sales will appear here after Shopify is connected."
        }
      />
    );
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">
          Customers by spend
        </h2>
        <p className="mt-1 text-xs text-muted">
          {periodLabel} · names only, no emails · New means 1 lifetime Shopify
          order, not “new-customer orders” on True Performance
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="dash-table min-w-[36rem]">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Last order in range</th>
              <th className="num">Orders</th>
              <th className="num">Lifetime orders</th>
              <th className="num">Spend</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="text-foreground">{customer.name}</td>
                <td className="text-muted">
                  {customer.isNew ? "New" : "Returning"}
                </td>
                <td className="text-muted">
                  {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                </td>
                <td className="num text-muted">
                  {formatNumber(customer.orderCount)}
                </td>
                <td className="num text-muted">
                  {formatNumber(customer.lifetimeOrders)}
                </td>
                <td className="num text-foreground">
                  {formatMoney(customer.spend)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
