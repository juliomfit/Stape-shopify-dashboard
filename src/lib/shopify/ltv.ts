import { pacificYearMonth } from "./cohorts.ts";

export const LTV_WINDOWS = [30, 60, 90, 180, 365] as const;
export type LtvWindowDays = (typeof LTV_WINDOWS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

export type LtvOrderInput = {
  createdAt: string;
  amount: number;
  customerId: string | null;
  firstTouchChannel: string;
  firstProductTitle?: string | null;
};

export type CustomerLtv = {
  customerId: string;
  firstOrderAt: number;
  firstOrderRevenue: number;
  firstChannel: string;
  firstProduct: string | null;
  orderCount: number;
  lifetimeRevenue: number;
  windowRevenue: Record<LtvWindowDays, number>;
};

export type LtvCohortRow = {
  cohort: string;
  customers: number;
  firstOrderRevenue: number;
  repeatOrders: number;
  repeatRate: number;
  windowRevenue: Record<LtvWindowDays, number>;
  ltv: Record<LtvWindowDays, number>;
  mature: Record<LtvWindowDays, boolean>;
};

function emptyWindows(): Record<LtvWindowDays, number> {
  return { 30: 0, 60: 0, 90: 0, 180: 0, 365: 0 };
}

function emptyMature(value: boolean): Record<LtvWindowDays, boolean> {
  return { 30: value, 60: value, 90: value, 180: value, 365: value };
}

export function customersFromOrders(orders: LtvOrderInput[]): CustomerLtv[] {
  const byCustomer = new Map<string, LtvOrderInput[]>();
  for (const order of orders) {
    if (!order.customerId) {
      continue;
    }
    const list = byCustomer.get(order.customerId) ?? [];
    list.push(order);
    byCustomer.set(order.customerId, list);
  }

  const out: CustomerLtv[] = [];
  for (const [customerId, list] of byCustomer) {
    const sorted = [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const first = sorted[0];
    const firstAt = new Date(first.createdAt).getTime();
    const windowRevenue = emptyWindows();
    let lifetime = 0;
    for (const order of sorted) {
      const ts = new Date(order.createdAt).getTime();
      lifetime += order.amount;
      const age = ts - firstAt;
      for (const days of LTV_WINDOWS) {
        if (age <= days * DAY_MS) {
          windowRevenue[days] += order.amount;
        }
      }
    }
    out.push({
      customerId,
      firstOrderAt: firstAt,
      firstOrderRevenue: first.amount,
      firstChannel: first.firstTouchChannel,
      firstProduct: first.firstProductTitle ?? null,
      orderCount: sorted.length,
      lifetimeRevenue: lifetime,
      windowRevenue,
    });
  }
  return out;
}

function matureFor(firstOrderAt: number, days: number, now: number) {
  return now - firstOrderAt >= days * DAY_MS;
}

export function rollupLtvCohorts(
  orders: LtvOrderInput[],
  now = Date.now(),
  group: "month" | "channel" | "product" = "month",
): LtvCohortRow[] {
  const customers = customersFromOrders(orders);
  const buckets = new Map<string, CustomerLtv[]>();

  for (const customer of customers) {
    const key =
      group === "channel"
        ? customer.firstChannel || "Unknown"
        : group === "product"
          ? customer.firstProduct || "Unknown"
          : pacificYearMonth(new Date(customer.firstOrderAt).toISOString());
    const list = buckets.get(key) ?? [];
    list.push(customer);
    buckets.set(key, list);
  }

  return [...buckets.entries()]
    .map(([cohort, list]) => {
      const customersN = list.length;
      const windowRevenue = emptyWindows();
      const mature = emptyMature(true);
      let firstOrderRevenue = 0;
      let repeatOrders = 0;
      let repeaters = 0;
      for (const customer of list) {
        firstOrderRevenue += customer.firstOrderRevenue;
        repeatOrders += Math.max(customer.orderCount - 1, 0);
        if (customer.orderCount > 1) {
          repeaters += 1;
        }
        for (const days of LTV_WINDOWS) {
          windowRevenue[days] += customer.windowRevenue[days];
          if (!matureFor(customer.firstOrderAt, days, now)) {
            mature[days] = false;
          }
        }
      }
      const ltv = emptyWindows();
      for (const days of LTV_WINDOWS) {
        ltv[days] = customersN > 0 ? windowRevenue[days] / customersN : 0;
      }
      return {
        cohort,
        customers: customersN,
        firstOrderRevenue,
        repeatOrders,
        repeatRate: customersN > 0 ? repeaters / customersN : 0,
        windowRevenue,
        ltv,
        mature,
      };
    })
    .sort((a, b) => b.cohort.localeCompare(a.cohort));
}

export function ltvByChannel(orders: LtvOrderInput[], now = Date.now()) {
  return rollupLtvCohorts(orders, now, "channel");
}

export function ltvByFirstProduct(orders: LtvOrderInput[], now = Date.now()) {
  return rollupLtvCohorts(orders, now, "product");
}
