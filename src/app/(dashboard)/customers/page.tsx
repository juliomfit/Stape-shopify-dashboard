import type { Metadata } from "next";
import { ConnectionStatus } from "@/components/dashboard/ConnectionStatus";
import { CustomersTable } from "@/components/dashboard/CustomersTable";
import { CustomerCohortTable } from "@/components/dashboard/CustomerCohortTable";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ScopeHelp } from "@/components/dashboard/ScopeHelp";
import { TruncationNotice } from "@/components/dashboard/TruncationNotice";
import { Header } from "@/components/layout/Header";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { getShopifyCustomerMetrics } from "@/lib/shopify/get-customer-metrics";
import { rollupCustomerCohorts } from "@/lib/shopify/cohorts";
import { ltvByChannel, rollupLtvCohorts } from "@/lib/shopify/ltv";
import { getShopifyOverviewMetrics } from "@/lib/shopify/get-overview-metrics";
import { LtvTable } from "@/components/dashboard/LtvTable";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers",
};

export default async function CustomersPage() {
  const shopify = await getShopifyCustomerMetrics();
  const overview = await getShopifyOverviewMetrics();
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
  const currency = shopify.customers[0]?.spend.currencyCode || "USD";
  const rangeRevenue = shopify.customers.reduce(
    (sum, customer) => sum + customer.spend.amount,
    0,
  );
  const revenuePerCustomer =
    identified > 0 ? rangeRevenue / identified : null;
  const ltvOrders = overview.orderPoints.map((order) => ({
    createdAt: order.createdAt,
    amount: order.amount,
    customerId: order.customerId,
    firstTouchChannel: order.firstTouchChannel,
    firstProductTitle: order.firstProductTitle,
  }));
  const ltvCohorts = rollupLtvCohorts(ltvOrders);
  const ltvChannels = ltvByChannel(ltvOrders);
  const cohorts = rollupCustomerCohorts(
    shopify.customers.map((customer) => ({
      createdAt: customer.createdAt,
      orderCount: customer.orderCount,
      spend: customer.spend.amount,
      isNew: customer.isNew,
    })),
  );

  return (
    <>
      <Header
        title="Customers"
        description="Shopify customers who ordered in the selected date range. LTV below is selected-history only — not complete lifetime."
      />
      <section className="dash-page gap-6">
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
              <MetricCard
                label="Revenue / customer"
                source={`${shopifySource} · spend in this range ÷ identified customers · not lifetime LTV`}
                value={
                  shopify.status.state === "connected" &&
                  revenuePerCustomer !== null
                    ? formatMoney({
                        amount: revenuePerCustomer,
                        currencyCode: currency,
                      })
                    : null
                }
              />
            </div>
            <p className="text-xs leading-5 text-muted">
              New vs returning here is unique people (lifetime numberOfOrders).
              First-touch new-customer orders is order grain and will not
              match. Last order date is the latest order in this header range.
              Range revenue / customer is not LTV — see selected-history LTV
              below (incomplete: only orders loaded for this header range, max
              10k). True first-purchase LTV needs a full Shopify order mirror.
            </p>
            <LtvTable
              rows={ltvCohorts}
              currencyCode={currency}
              title="Selected-history LTV (incomplete)"
            />
            <LtvTable
              rows={ltvChannels}
              currencyCode={currency}
              title="Selected-history LTV by first-touch channel (incomplete)"
            />
            <CustomerCohortTable
              rows={cohorts}
              currencyCode={currency}
              periodLabel={shopify.periodLabel}
            />
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
