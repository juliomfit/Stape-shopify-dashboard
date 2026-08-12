import { getSelectedPeriod } from "@/lib/period-server";
import type { DashboardPeriod } from "@/lib/period";

export type AlignedPeriod = DashboardPeriod;

export async function getAlignedPeriod(): Promise<DashboardPeriod> {
  return getSelectedPeriod();
}

export function shopifyMetricsSince(
  orderPoints: {
    createdAt: string;
    amount: number;
    isNew?: boolean | null;
    isGuest?: boolean;
  }[],
  startMs: number,
  endMs?: number,
) {
  const matched = orderPoints.filter((order) => {
    const created = new Date(order.createdAt).getTime();
    if (created < startMs) {
      return false;
    }

    if (endMs !== undefined && created >= endMs) {
      return false;
    }

    return true;
  });

  return {
    orders: matched.length,
    revenue: matched.reduce((total, order) => total + order.amount, 0),
    newCustomerOrders: matched.filter((order) => order.isNew === true).length,
    returningCustomerOrders: matched.filter((order) => order.isNew === false)
      .length,
    guestOrders: matched.filter((order) => order.isGuest).length,
    newCustomerRevenue: matched
      .filter((order) => order.isNew === true)
      .reduce((total, order) => total + order.amount, 0),
    returningCustomerRevenue: matched
      .filter((order) => order.isNew === false)
      .reduce((total, order) => total + order.amount, 0),
  };
}
