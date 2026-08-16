/**
 * Canonical metric formulas. Dashboard and GPT must use these.
 *
 * Reporting timezone: America/Los_Angeles (DASHBOARD_TZ).
 * Currency: Shopify order currency; do not mix currencies in one total.
 *
 * Labels:
 * - Platform-attributed = Meta/Google Ads Manager conversions (their matching).
 * - Blended = Shopify revenue ÷ (Meta spend + Google spend) when spend is known.
 * - First-party observed = Shopify gn_* first-touch (True Performance).
 *
 * Missing spend is null (shown as —), never 0.
 * Missing gn_* is Unknown, not Direct.
 * COGS is never invented and never filled from typicalCogs.
 * Contribution profit without cogs is revenue − fees − ad spend.
 * Pass cogs only when every Pacific day in the range has a typed supplier row.
 */

export function ratio(numerator: number, spend: number | null): number | null {
  if (spend === null || spend <= 0) {
    return null;
  }
  return numerator / spend;
}

/** MER = blended ad spend ÷ Shopify total revenue. Inverse of blended ROAS. */
export function merRatio(spend: number | null, orderRevenue: number): number | null {
  if (spend === null || spend <= 0 || orderRevenue <= 0) {
    return null;
  }
  return spend / orderRevenue;
}

/** Blended CPA = ad spend ÷ Shopify orders with total > $0. */
export function blendedCpa(spend: number | null, paidOrders: number): number | null {
  if (spend === null || paidOrders <= 0) {
    return null;
  }
  return spend / paidOrders;
}

export function aov(revenue: number | null, orders: number | null): number | null {
  if (revenue === null || orders === null || orders <= 0) {
    return null;
  }
  return revenue / orders;
}

export function cpc(spend: number | null, clicks: number | null): number | null {
  if (spend === null || clicks === null || clicks <= 0) {
    return null;
  }
  return spend / clicks;
}

export function cpm(spend: number | null, impressions: number | null): number | null {
  if (spend === null || impressions === null || impressions <= 0) {
    return null;
  }
  return (spend / impressions) * 1000;
}

export function ctr(clicks: number | null, impressions: number | null): number | null {
  if (clicks === null || impressions === null || impressions <= 0) {
    return null;
  }
  return clicks / impressions;
}

export function platformRoas(
  purchaseValue: number | null,
  spend: number | null,
): number | null {
  return ratio(purchaseValue ?? 0, spend);
}

export function platformCpa(
  spend: number | null,
  purchases: number | null,
): number | null {
  if (spend === null || purchases === null || purchases <= 0) {
    return null;
  }
  return spend / purchases;
}

export function netAfterFees(
  totalRevenue: number,
  processingFees: number | null,
  refundFees: number | null,
): number {
  return totalRevenue - (processingFees ?? 0) - (refundFees ?? 0);
}

/**
 * Contribution profit (not net profit): Shopify total − Shopify Payments fees − ad spend.
 * Does not subtract COGS, shipping expense, or other opex unless those values are supplied.
 * Callers must omit `cogs` when the daily ledger is incomplete so this does not treat missing days as $0.
 */
export function contributionProfit(input: {
  totalRevenue: number;
  processingFees: number | null;
  refundFees: number | null;
  adSpend: number | null;
  cogs?: number | null;
  shippingExpense?: number | null;
}): number | null {
  if (input.adSpend === null) {
    return null;
  }
  const cogs = input.cogs ?? 0;
  const shipping = input.shippingExpense ?? 0;
  return (
    netAfterFees(input.totalRevenue, input.processingFees, input.refundFees) -
    input.adSpend -
    cogs -
    shipping
  );
}

export function contributionMargin(
  profit: number | null,
  totalRevenue: number,
): number | null {
  if (profit === null || totalRevenue <= 0) {
    return null;
  }
  return profit / totalRevenue;
}

export function newCustomerCpa(
  spend: number | null,
  newCustomerOrders: number | null,
): number | null {
  if (spend === null || newCustomerOrders === null || newCustomerOrders <= 0) {
    return null;
  }
  return spend / newCustomerOrders;
}

export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return (current - previous) / previous;
}

export function coverageRatio(captured: number | null, shopify: number | null): number | null {
  if (captured === null || shopify === null || shopify <= 0) {
    return null;
  }
  return captured / shopify;
}
