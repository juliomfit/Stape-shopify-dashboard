import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { clickIdLabel } from "@/lib/shopify/first-touch";
import { getShopifyOrder } from "@/lib/shopify/get-order";
import { mismatchLabel, truncateReferrer } from "@/lib/shopify/journey";

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

  const journey = order.journey;
  const first = journey?.firstVisit;
  const last = journey?.lastVisit;

  return (
    <>
      <Header
        title={order.name}
        description="First-touch is from storefront gn_* cart attributes, not Shopify session."
      />
      <section className="flex flex-1 flex-col gap-5 p-6">
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
                value={order.refundFees ? formatMoney(order.refundFees) : "—"}
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
        <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">
            Shopify Attribution (Admin)
          </h2>
          <p className="mt-1 text-xs text-muted">
            30-day session journey. First-click is firstVisit. Last-click is
            lastVisit. Not used for True Performance gn_* rules.
          </p>
          {journey ? (
            <div className="mt-2 grid gap-4 lg:grid-cols-2">
              <div>
                <Detail
                  label="Ready"
                  value={journey.ready ? "Yes" : "Not ready"}
                />
                <Detail
                  label="Mismatch"
                  value={mismatchLabel(order.journeyMismatch) || "None"}
                />
                <Detail
                  label="Days to conversion"
                  value={
                    journey.daysToConversion === null
                      ? "—"
                      : String(journey.daysToConversion)
                  }
                />
                <Detail
                  label="Shopify first-click"
                  value={journey.firstClick.label}
                />
                <Detail
                  label="First landing"
                  value={truncateReferrer(first?.landingPage || "", 120)}
                />
                <Detail
                  label="First referrer"
                  value={truncateReferrer(first?.referrerUrl || "", 120)}
                />
                <Detail
                  label="First UTM"
                  value={[first?.utmSource, first?.utmMedium, first?.utmCampaign]
                    .filter(Boolean)
                    .join(" / ")}
                />
              </div>
              <div>
                <Detail
                  label="Shopify last-click"
                  value={journey.lastClick.label}
                />
                <Detail
                  label="Last landing"
                  value={truncateReferrer(last?.landingPage || "", 120)}
                />
                <Detail
                  label="Last referrer"
                  value={truncateReferrer(last?.referrerUrl || "", 120)}
                />
                <Detail
                  label="Last UTM"
                  value={[last?.utmSource, last?.utmMedium, last?.utmCampaign]
                    .filter(Boolean)
                    .join(" / ")}
                />
                <Detail
                  label="First click ids"
                  value={
                    first
                      ? Object.entries(first.clickIds)
                          .map(([key, value]) => `${key}=${value}`)
                          .join(" ")
                      : ""
                  }
                />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              Shopify journey details were not available on this order.
            </p>
          )}
        </article>
      </section>
    </>
  );
}
