export function getConversionRate(
  orders: number | null,
  sessions: number | null,
) {
  if (orders === null || sessions === null || sessions <= 0) {
    return null;
  }

  return orders / sessions;
}

export function getAverageOrderValue(
  revenueAmount: number | null,
  orders: number | null,
) {
  if (revenueAmount === null || orders === null || orders <= 0) {
    return null;
  }

  return revenueAmount / orders;
}

export function findEventCount(
  eventCounts: { eventName: string; events: number; sessions: number }[],
  names: string[],
) {
  for (const name of names) {
    const match = eventCounts.find((item) => item.eventName === name);
    if (match) {
      return match;
    }
  }

  return { events: 0, sessions: 0 };
}
