import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { clickIdLabel } from "@/lib/shopify/first-touch";
import { getShopifyOrder } from "@/lib/shopify/get-order";

export const dynamic = "force-dynamic";

type OrderPageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "Order",
};

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

export default async function OrderDetailPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getShopifyOrder(id);

  if (!order) {
    notFound();
  }

  const last = order.shopifyLastTouch;

  return (
    <>
      <Header
        title={order.name}
        description="First-touch is from storefront gn_* cart attributes, not Shopify session."
      />
      <section className="dash-page gap-6">
        <p className="text-sm text-muted">
          <Link href="/sales" className="text-accent hover:underline">
            ← Sales
          </Link>
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Order</h2>
            <div className="mt-2">
              <Detail label="Date" value={formatDate(order.createdAt)} />
              <Detail label="Status" value={order.financialStatus} />
              <Detail label="Items" value={formatNumber(order.itemCount)} />
              <Detail label="Gross sales" value={formatMoney(order.gross)} />
              <Detail label="Total revenue" value={formatMoney(order.total)} />
              <Detail
                label="Processing fees"
                value={
                  order.processingFees
                    ? formatMoney(order.processingFees)
                    : "—"
                }
              />
              <Detail
                label="Refund fees"
                value={
                  order.refundFees ? formatMoney(order.refundFees) : "—"
                }
              />
              <Detail
                label="Customer"
                value={
                  order.isNew === true
                    ? "New"
                    : order.isNew === false
                      ? "Returning"
                      : "Guest / unknown"
                }
              />
              {order.customerId ? (
                <p className="pt-3 text-sm">
                  <Link href="/customers" className="text-accent hover:underline">
                    Customers
                  </Link>
                  <span className="text-muted"> · Shopify customer {order.customerId}</span>
                </p>
              ) : (
                <p className="pt-3 text-sm">
                  <Link href="/customers" className="text-accent hover:underline">
                    Customers
                  </Link>
                  <span className="text-muted"> · guest / no customer id</span>
                </p>
              )}
            </div>
          </article>
          <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              First-touch (gn_*)
            </h2>
            <div className="mt-2">
              <Detail label="Channel" value={order.firstTouchChannel} />
              <Detail
                label="Source / medium"
                value={[order.firstTouch.utmSource, order.firstTouch.utmMedium]
                  .filter(Boolean)
                  .join(" / ")}
              />
              <Detail label="Campaign" value={order.firstTouch.utmCampaign} />
              <Detail label="Content" value={order.firstTouch.utmContent} />
              <Detail label="Term" value={order.firstTouch.utmTerm} />
              <Detail label="Click ID" value={clickIdLabel(order.firstTouch)} />
              <Detail label="Landing path" value={order.firstTouch.landingPath} />
              <Detail label="Referrer host" value={order.firstTouch.referrer} />
              <Detail label="First-touch time" value={order.firstTouch.ts} />
            </div>
          </article>
        </div>
        <p className="text-sm text-muted">
          Same header period on{" "}
          <Link href="/products" className="text-accent hover:underline">
            Products
          </Link>
          ,{" "}
          <Link href="/attribution" className="text-accent hover:underline">
            True Performance
          </Link>
          , and{" "}
          <Link href="/meta" className="text-accent hover:underline">
            Meta Ads
          </Link>
          . First-touch is gn_*, not Ads Manager.
        </p>
        {order.lineItems.length > 0 ? (
          <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Line items</h2>
            <ul className="mt-3 divide-y divide-border text-sm">
              {order.lineItems.map((item, index) => (
                <li key={`${item.title}-${index}`} className="flex justify-between py-2">
                  <span>{item.title}</span>
                  <span className="text-muted">{formatNumber(item.quantity)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              <Link href="/products" className="underline">
                Products
              </Link>{" "}
              uses the same Shopify order range as Sales.
            </p>
          </article>
        ) : null}
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">
            Shopify last-touch / session
          </h2>
          <p className="mt-1 text-xs text-muted">
            Shopify’s own session details. This can differ from first-touch and
            is not used for our channel rules.
          </p>
          {last ? (
            <div className="mt-2">
              <Detail label="Source" value={[last.source, last.sourceType].filter(Boolean).join(" · ")} />
              <Detail
                label="UTM"
                value={[last.utmSource, last.utmMedium, last.utmCampaign]
                  .filter(Boolean)
                  .join(" / ")}
              />
              <Detail label="Landing page" value={last.landingPage} />
              <Detail label="Referrer" value={last.referrerUrl} />
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Shopify session details were not available on this order.
            </p>
          )}
        </article>
      </section>
    </>
  );
}
