export type CustomerCohortInput = {
  createdAt: string | null;
  orderCount: number;
  spend: number;
  isNew: boolean;
};

export type CustomerCohortRow = {
  /** YYYY-MM in America/Los_Angeles, or "Unknown". */
  cohort: string;
  customers: number;
  orders: number;
  revenue: number;
  newCustomers: number;
  avgRevenuePerCustomer: number;
};

const PACIFIC = "America/Los_Angeles";

export function pacificYearMonth(iso: string | null | undefined): string {
  if (!iso) {
    return "Unknown";
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown";
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) {
    return "Unknown";
  }
  return `${year}-${month}`;
}

/**
 * Cohort = Shopify customer `createdAt` month (Pacific).
 * Revenue and orders are spend/orders in the selected header range, not lifetime LTV.
 */
export function rollupCustomerCohorts(
  customers: CustomerCohortInput[],
): CustomerCohortRow[] {
  const byCohort = new Map<
    string,
    { customers: number; orders: number; revenue: number; newCustomers: number }
  >();

  for (const customer of customers) {
    const cohort = pacificYearMonth(customer.createdAt);
    const current = byCohort.get(cohort) ?? {
      customers: 0,
      orders: 0,
      revenue: 0,
      newCustomers: 0,
    };
    current.customers += 1;
    current.orders += customer.orderCount;
    current.revenue += customer.spend;
    if (customer.isNew) {
      current.newCustomers += 1;
    }
    byCohort.set(cohort, current);
  }

  return [...byCohort.entries()]
    .map(([cohort, row]) => ({
      cohort,
      customers: row.customers,
      orders: row.orders,
      revenue: row.revenue,
      newCustomers: row.newCustomers,
      avgRevenuePerCustomer:
        row.customers > 0 ? row.revenue / row.customers : 0,
    }))
    .sort((a, b) => b.cohort.localeCompare(a.cohort));
}
