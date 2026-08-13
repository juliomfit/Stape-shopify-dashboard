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
    gross?: number;
    subtotal?: number;
    discounts?: number;
    shipping?: number;
    tax?: number;
    refunded?: number;
    processingFees?: number | null;
    refundFees?: number | null;
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

  const processingFees = matched.reduce<number | null>((total, order) => {
    if (order.processingFees === null || order.processingFees === undefined) {
      return total;
    }

    return (total ?? 0) + order.processingFees;
  }, null);

  const refundFees = matched.reduce<number | null>((total, order) => {
    if (order.refundFees === null || order.refundFees === undefined) {
      return total;
    }

    return (total ?? 0) + order.refundFees;
  }, null);

  return {
    orders: matched.length,
    revenue: matched.reduce((total, order) => total + order.amount, 0),
    gross: matched.reduce((total, order) => total + (order.gross ?? 0), 0),
    subtotal: matched.reduce((total, order) => total + (order.subtotal ?? 0), 0),
    discounts: matched.reduce(
      (total, order) => total + (order.discounts ?? 0),
      0,
    ),
    shipping: matched.reduce((total, order) => total + (order.shipping ?? 0), 0),
    tax: matched.reduce((total, order) => total + (order.tax ?? 0), 0),
    refunded: matched.reduce((total, order) => total + (order.refunded ?? 0), 0),
    processingFees,
    refundFees,
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
