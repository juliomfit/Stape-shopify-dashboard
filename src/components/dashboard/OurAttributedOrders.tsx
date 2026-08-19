import { OrderAttributionDebugger } from "@/components/dashboard/OrderAttributionDebugger";
import { formatMoney, formatPercent } from "@/lib/format";
import type { EnrichedCredit } from "@/lib/attribution/meta-credit";
import type { CanonicalAttributedOrder } from "@/lib/warehouse/canonical-orders";
import { DEFAULT_ATTRIBUTION_WINDOW_DAYS } from "@/lib/attribution/windows";

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
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm lg:p-6">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Existing model credit, enriched with Meta IDs. Mapping method and
        confidence are identity joins — they do not change the weight.
      </p>
      {credits.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No OUR Meta credit for this grain.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {credits.map((credit) => {
            const order = ordersById.get(credit.orderName);
            return (
              <div key={`${credit.orderName}-${credit.metaCampaignId}-${credit.metaAdId}`} className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium text-foreground">
                  Order {credit.orderName} · {credit.model} · {credit.windowDays}d · credit{" "}
                  {formatPercent(credit.weight)} ·{" "}
                  {formatMoney({ amount: credit.creditDollars, currencyCode })}
                </p>
                <p className="mt-1 font-mono text-xs text-muted">
                  campaign {credit.metaCampaignId ?? "—"} · adset {credit.metaAdsetId ?? "—"} · ad{" "}
                  {credit.metaAdId ?? "—"} · {credit.campaignMappingMethod} ·{" "}
                  {credit.campaignMappingConfidence}
                  {credit.metaCreativeId ? ` · creative ${credit.metaCreativeId}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted">Journey {credit.journey}</p>
                {order ? (
                  <div className="mt-4">
                    <OrderAttributionDebugger
                      order={order}
                      lookbackDays={lookbackDays}
                      currencyCode={currencyCode}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
