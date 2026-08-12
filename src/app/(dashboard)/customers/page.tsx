import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { CustomersTable } from "@/components/dashboard/CustomersTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Header } from "@/components/layout/Header";
import { formatNumber } from "@/lib/format";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  const shopify = await getShopifyOverviewMetrics();
  const shopifySource =
    shopify.status.state === "connected"
      ? `Shopify · ${shopify.periodLabel}`
      : "Shopify · no data yet";
  const newCustomers = shopify.customers.filter((customer) => customer.isNew)
    .length;
  const returningCustomers = shopify.customers.length - newCustomers;

  return (
    <>
      <Header
        title="Customers"
        description="Shopify customers who ordered in the last 30 days."
      />
      <section className="flex flex-1 flex-col gap-6 p-8">
        <ConnectionStatus shopify={shopify.status} />
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
            label="New"
            source={shopifySource}
            value={
              shopify.status.state === "connected"
                ? formatNumber(newCustomers)
                : null
            }
          />
          <MetricCard
            label="Returning"
            source={shopifySource}
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
        </div>
        <CustomersTable customers={shopify.customers} />
      </section>
    </>
  );
}
