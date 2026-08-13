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
  processingFees: number | null;
  refundFees: number | null;
  periodLabel: string;
};

function Row({
  label,
  amount,
  currencyCode,
  muted = false,
}: {
  label: string;
  amount: number | null;
  currencyCode: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className={muted ? "text-sm text-muted" : "text-sm text-foreground"}>
        {label}
      </span>
      <span className={muted ? "text-sm text-muted" : "text-sm text-foreground"}>
        {amount === null ? "—" : formatMoney({ amount, currencyCode })}
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
  processingFees,
  refundFees,
  periodLabel,
}: RevenueBreakdownProps) {
  const netAfterFees =
    processingFees === null ? null : total - processingFees;

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Shopify revenue breakdown
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Same orders as the header range · {periodLabel}. Gross is line items
        before discounts. Total is what the customer paid. Fees are Shopify
        Payments only — they are not inside total revenue.
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
        <Row
          label="Processing fees"
          amount={processingFees}
          currencyCode={currencyCode}
          muted
        />
        <Row
          label="Refund fees"
          amount={refundFees}
          currencyCode={currencyCode}
          muted
        />
        <Row
          label="Net after processing fees"
          amount={netAfterFees}
          currencyCode={currencyCode}
        />
      </div>
    </article>
  );
}
