import { formatMoney } from "@/lib/format";

type RevenueBreakdownProps = {
  currencyCode: string;
  gross: number;
  subtotal: number;
  discounts: number;
  shipping: number;
  tax: number;
  refunded: number;
  total: number;
  periodLabel: string;
};

function Row({
  label,
  amount,
  currencyCode,
  muted = false,
}: {
  label: string;
  amount: number;
  currencyCode: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className={muted ? "text-sm text-muted" : "text-sm text-foreground"}>
        {label}
      </span>
      <span className={muted ? "text-sm text-muted" : "text-sm text-foreground"}>
        {formatMoney({ amount, currencyCode })}
      </span>
    </div>
  );
}

export function RevenueBreakdown({
  currencyCode,
  gross,
  subtotal,
  discounts,
  shipping,
  tax,
  refunded,
  total,
  periodLabel,
}: RevenueBreakdownProps) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Shopify revenue breakdown
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Same orders as the header range · {periodLabel}. Gross is line items
        before discounts. Total is currentTotalPriceSet after discounts,
        shipping, tax, and refunds.
      </p>
      <div className="mt-4 divide-y divide-border">
        <Row label="Gross sales" amount={gross} currencyCode={currencyCode} />
        <Row
          label="Discounts"
          amount={discounts}
          currencyCode={currencyCode}
          muted
        />
        <Row
          label="Subtotal after discounts"
          amount={subtotal}
          currencyCode={currencyCode}
        />
        <Row label="Shipping" amount={shipping} currencyCode={currencyCode} />
        <Row label="Tax" amount={tax} currencyCode={currencyCode} />
        <Row
          label="Refunded"
          amount={refunded}
          currencyCode={currencyCode}
          muted
        />
        <Row label="Total revenue" amount={total} currencyCode={currencyCode} />
      </div>
    </article>
  );
}
