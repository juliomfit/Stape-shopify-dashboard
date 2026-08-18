import type { CustomerPerformance } from "@/lib/shopify/types";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { EmptyTable } from "@/components/dashboard/EmptyTable";

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
      <EmptyTable
        title="Customers"
        why={
          connected
            ? `No customers with orders in ${periodLabel}.`
            : "Customer sales will appear here after Shopify is connected."
        }
        next={
          connected
            ? [
                { kind: "range", range: "7d", label: "7d" },
                { kind: "href", href: "/sales", label: "Sales" },
              ]
            : [{ kind: "href", href: "/integrations", label: "Integrations" }]
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
          order, not “new-customer orders” on First-touch
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              <th className="px-6 py-3 font-medium">Customer</th>
              <th className="px-6 py-3 font-medium">Type</th>
                <th className="px-6 py-3 font-medium">Last order in range</th>
                <th className="px-6 py-3 text-right font-medium">Orders</th>
                <th className="px-6 py-3 text-right font-medium">Lifetime orders</th>
                <th className="px-6 py-3 text-right font-medium">Spend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-6 py-3 text-foreground">{customer.name}</td>
                <td className="px-6 py-3 text-muted">
                  {customer.isNew ? "New" : "Returning"}
                </td>
                <td className="px-6 py-3 text-muted">
                  {customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "—"}
                </td>
                <td className="px-6 py-3 text-right text-muted">
                  {formatNumber(customer.orderCount)}
                </td>
                <td className="px-6 py-3 text-right text-muted">
                  {formatNumber(customer.lifetimeOrders)}
                </td>
                <td className="px-6 py-3 text-right text-foreground">
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
