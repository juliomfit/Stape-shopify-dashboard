import { OrderAttributionDebugger } from "@/components/dashboard/OrderAttributionDebugger";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { EnrichedCredit } from "@/lib/attribution/meta-credit";
import type { CanonicalAttributedOrder } from "@/lib/warehouse/canonical-orders";
import { DEFAULT_ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/windows";
import { FirstPartySourceLabel } from "@/components/dashboard/MetaSourceBadges";
import Link from "next/link";

export type OurAttributedOrdersProps = {
  title: string;
  credits: EnrichedCredit[];
  ordersById: Map<string, CanonicalAttributedOrder>;
  currencyCode: string;
  lookbackDays?: number;
};

export function OurAttributedOrders({
  title,
  credits,
  ordersById,
  currencyCode,
  lookbackDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS,
}: OurAttributedOrdersProps) {
  const money = (amount: number) => formatMoney({ amount, currencyCode });
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <FirstPartySourceLabel extra="Existing model credit. Mapping does not change the weight." />
      {credits.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No OUR Meta credit for this grain.</p>
      ) : (
        <div className="mt-4 space-y-4">
          {credits.map((credit) => {
            const order = ordersById.get(credit.orderName);
            const revenue = order?.shopifyNetRevenue ?? order?.eventPurchaseValue ?? 0;
            return (
              <details
                key={`${credit.orderName}-${credit.observedAdId ?? credit.metaAdId}-${credit.weight}`}
                className="rounded-xl border border-border p-4"
              >
                <summary className="cursor-pointer">
                  <div className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <p>
                      Order{" "}
                      <Link
                        prefetch={false}
                        href={`/sales/${encodeURIComponent(credit.orderName)}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {credit.orderName}
                      </Link>
                    </p>
                    <p>Revenue {money(revenue)}</p>
                    <p>Credit {formatPercent(credit.weight)}</p>
                    <p>Attributed {money(credit.creditDollars)}</p>
                    <p>{credit.isNewCustomer ? "New" : "Returning"}</p>
                    <p>Touch {credit.purchaseTs ? formatDate(new Date(credit.purchaseTs).toISOString()) : "—"}</p>
                    <p className="sm:col-span-2 truncate text-muted" title={credit.journey}>
                      Journey {credit.journey}
                    </p>
                  </div>
                </summary>
                {order ? (
                  <div className="mt-4">
                    <OrderAttributionDebugger
                      order={order}
                      lookbackDays={lookbackDays}
                      currencyCode={currencyCode}
                    />
                  </div>
                ) : null}
              </details>
            );
          })}
        </div>
      )}
    </article>
  );
}
