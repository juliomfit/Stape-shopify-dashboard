import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { CustomersTable } from "@/components/dashboard/CustomersTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ScopeHelp } from "@/components/dashboard/ScopeHelp";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { formatNumber, formatPercent } from "@/lib/format";
import { getShopifyCustomerMetrics } from "@/lib/shopify/get-customer-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  const shopify = await getShopifyCustomerMetrics();
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${shopify.periodLabel}`
      : "Shopify · no data yet";
  const needsCustomerScope =
    shopify.status.state === "error" &&
    shopify.status.message.toLowerCase().includes("read_customers");
  const newCustomers = shopify.customers.filter((customer) => customer.isNew)
    .length;
  const returningCustomers = shopify.customers.length - newCustomers;
  const identified = shopify.customers.length;
  const repeatRate = identified > 0 ? returningCustomers / identified : null;

  return (
    <>
      <Header
        title="Customers"
        description="Shopify customers who ordered in the selected date range."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} />
        {needsCustomerScope ? (
          <ScopeHelp
            title="Add one Shopify permission"
            steps={[
              "Open the Shopify Dev Dashboard and your Stape Dashboard app.",
              "Create a new version.",
              "In Scopes, keep read_orders and read_products, and add read_customers.",
              "Click Release.",
              "Open the app on your store and approve the new permission.",
              "Refresh this page.",
            ]}
          />
        ) : (
          <>
            <TruncationNotice
              truncated={shopify.truncated}
              fetched={shopify.fetchedOrders}
              noun="orders"
            />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Customers"
                source={shopifySource}
                value={
                  shopify.status.state === "connected"
                    ? formatNumber(shopify.customers.length)
                    : null
                }
              />
              <MetricCard
                label="New customers"
                source={`${shopifySource} · unique people with 1 lifetime order`}
                value={
                  shopify.status.state === "connected"
                    ? formatNumber(newCustomers)
                    : null
                }
              />
              <MetricCard
                label="Returning customers"
                source={`${shopifySource} · unique people with 2+ lifetime orders`}
                value={
                  shopify.status.state === "connected"
                    ? formatNumber(returningCustomers)
                    : null
                }
              />
              <MetricCard
                label="Guest checkouts"
                source={shopifySource}
                value={
                  shopify.status.state === "connected"
                    ? formatNumber(shopify.guestOrders)
                    : null
                }
              />
              <MetricCard
                label="Repeat rate"
                source={`${shopifySource} · unique people with 2+ lifetime orders ÷ identified customers`}
                value={
                  shopify.status.state === "connected" && repeatRate !== null
                    ? formatPercent(repeatRate)
                    : null
                }
              />
            </div>
            <p className="text-xs leading-5 text-muted">
              New vs returning here is unique people (lifetime numberOfOrders).
              True Performance new-customer orders is order grain and will not
              match. Last order date is the latest order in this header range,
              not a guessed lifetime recency.
            </p>
            <CustomersTable
              customers={shopify.customers}
              periodLabel={shopify.periodLabel}
              connected={shopify.status.state === "connected"}
            />
          </>
        )}
      </section>
    </>
  );
}
