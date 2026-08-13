import { formatMoney, formatNumber } from "@/lib/format";
import type { ShopifyStapeMismatch } from "@/lib/dashboard/kpis";

type MismatchBannerProps = {
  mismatch: ShopifyStapeMismatch | null;
  currencyCode: string;
};

export function MismatchBanner({ mismatch, currencyCode }: MismatchBannerProps) {
  if (!mismatch) {
    return null;
  }

  return (
    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
      Shopify and Stape disagree for this header range: Shopify{" "}
      {formatNumber(mismatch.shopifyOrders)} orders /{" "}
      {formatMoney({ amount: mismatch.shopifyRevenue, currencyCode })} vs Stape{" "}
      {formatNumber(mismatch.stapePurchases)} purchases /{" "}
      {formatMoney({ amount: mismatch.stapeRevenue, currencyCode })}. Trust
      Shopify for sales. Stape purchases are tracking comparison only.
    </p>
  );
}
