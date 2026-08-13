import { formatNumber, formatPercent } from "@/lib/format";
import type { WarehouseQuality } from "@/lib/warehouse/types";

type WarehouseQualityPanelProps = {
  quality: WarehouseQuality;
  totalOrders: number;
};

function rate(filled: number, total: number) {
  if (total <= 0) {
    return "—";
  }
  return formatPercent(filled / total);
}

export function WarehouseQualityPanel({
  quality,
  totalOrders,
}: WarehouseQualityPanelProps) {
  const sessionPaid = quality.paidSessions;
  const rows = [
    {
      label: "% orders with transaction_id",
      value: rate(quality.ordersWithTransactionId, totalOrders),
    },
    {
      label: "% orders with person_id",
      value: rate(quality.ordersWithPersonId, totalOrders),
    },
    {
      label: "% orders with hashed email (BQ)",
      value: rate(quality.ordersWithHashedEmail, totalOrders),
    },
    {
      label: "% orders with gn_uid (BQ column)",
      value: rate(quality.ordersWithGnUid, totalOrders),
    },
    {
      label: "% orders with X-Stape-User-Id (BQ)",
      value: rate(quality.ordersWithStapeUserId, totalOrders),
    },
    {
      label: "% orders with Shopify customer_id",
      value: rate(quality.ordersWithShopifyCustomerId, totalOrders),
    },
    {
      label: "Shopify orders with gn_uid attribute",
      value: rate(quality.shopifyGnUidOrders, totalOrders),
    },
    {
      label: "% paid sessions with click IDs",
      value: rate(quality.paidSessionsWithClickId, sessionPaid),
    },
    {
      label: "% Meta sessions with fbclid",
      value: rate(quality.metaSessionsWithFbclid, quality.metaSessions),
    },
    {
      label: "% Google Ads sessions with gclid/gbraid/wbraid",
      value: rate(
        quality.googleSessionsWithGoogleClickId,
        quality.googleSessions,
      ),
    },
    {
      label: "% purchases with a pre-purchase session",
      value: rate(quality.ordersWithPrepurchasesSession, totalOrders),
    },
    {
      label: "High-confidence attributed orders",
      value: rate(quality.highConfidenceOrders, totalOrders),
    },
    {
      label: "Duplicate purchase events (pixel copies)",
      value: formatNumber(quality.purchaseEventCopies),
    },
    {
      label: "Canonical orders (transaction_id)",
      value: formatNumber(quality.canonicalOrders),
    },
    {
      label: "Identity collisions",
      value: formatNumber(quality.identityCollisions),
    },
    {
      label: "Late events",
      value: formatNumber(quality.lateEvents),
    },
    {
      label: "Orphan touchpoints (no later order)",
      value: formatNumber(quality.orphanTouchpoints),
    },
  ];

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Attribution quality
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Tracking health for this date range. 0% on gn_uid / hashed email /
        X-Stape-User-Id means those fields are not in BigQuery yet — not that
        Stape Store is empty.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <span className="text-sm text-foreground">{row.label}</span>
            <span className="text-sm text-muted">{row.value}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
