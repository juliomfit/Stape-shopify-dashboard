export type ConversionResult = {
  rate: number | null;
  note: string;
};

const MIN_SESSIONS = 10;

export function getConversionRate(
  orders: number | null,
  sessions: number | null,
): ConversionResult {
  if (orders === null || sessions === null || sessions <= 0) {
    return {
      rate: null,
      note: "Shopify + Stape · no data yet",
    };
  }

  if (sessions < MIN_SESSIONS) {
    return {
      rate: null,
      note: `Need at least ${MIN_SESSIONS} Stape sessions before conversion rate is reliable`,
    };
  }

  if (orders > sessions) {
    return {
      rate: null,
      note: "Not comparable yet · Shopify orders still outnumber Stape sessions",
    };
  }

  return {
    rate: orders / sessions,
    note: "Purchases ÷ sessions",
  };
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
