import type { Money } from "@/lib/shopify/types";

export function formatMoney(money: Money) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: money.currencyCode,
    maximumFractionDigits: 2,
  }).format(money.amount);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
