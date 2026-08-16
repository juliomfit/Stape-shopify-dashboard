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
  adSpend: number | null;
  periodLabel: string;
  cogs?: number | null;
  cogsComplete?: boolean;
  missingCogsDates?: string[];
  cogsSource?: string;
  profitAfterCogs?: number | null;
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
  adSpend,
  periodLabel,
  cogs = null,
  cogsComplete = false,
  missingCogsDates = [],
  cogsSource,
  profitAfterCogs = null,
}: RevenueBreakdownProps) {
  const feesKnown = (processingFees ?? 0) + (refundFees ?? 0);
  const netAfterFees = total - feesKnown;
  const netProfit = adSpend === null ? null : netAfterFees - adSpend;
  const afterCogs =
    cogsComplete && cogs !== null && adSpend !== null
      ? profitAfterCogs ?? netAfterFees - adSpend - cogs
      : null;

  return (
    <article className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">
        Shopify revenue breakdown
      </h2>
      <p className="mt-1 text-xs leading-5 text-muted">
        Same orders and the same header dates · {periodLabel}. Gross is line
        items before discounts. Total is what the customer paid. Ad spend is
        Meta + Google pasted or synced for this range only — not guessed, not
        first-touch. Contribution is total − Shopify fees − ad spend. Product
        cost is subtracted only when every Pacific day in this range has a
        supplier COGS row — never guessed, never typicalCogs.
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
        <Row
          label="Ad spend"
          amount={adSpend}
          currencyCode={currencyCode}
          muted
        />
        {adSpend === null ? (
          <p className="py-2 text-sm text-amber-800">
            No ad spend saved for these dates.
          </p>
        ) : null}
        <Row
          label="Contribution (no COGS)"
          amount={netProfit}
          currencyCode={currencyCode}
        />
        <Row
          label="Supplier COGS"
          amount={cogsComplete ? cogs : null}
          currencyCode={currencyCode}
          muted
        />
        {cogsComplete ? null : (
          <p className="py-2 text-sm text-amber-800">
            {cogsSource ||
              (missingCogsDates.length
                ? `Missing supplier COGS · ${missingCogsDates.join(", ")}`
                : "Supplier COGS incomplete for these dates.")}
          </p>
        )}
        <Row
          label="Profit after COGS"
          amount={afterCogs}
          currencyCode={currencyCode}
        />
      </div>
    </article>
  );
}
