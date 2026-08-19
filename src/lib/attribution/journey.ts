import type { AttributedOrder } from "@/lib/stape/attribution-types";
import type { Touchpoint } from "@/lib/attribution/engine";
import { isDirectChannel, isPaidChannel } from "@/lib/attribution/channel";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Convert an attributed order's canonical session touches into engine Touchpoints. */
export function orderToTouchpoints(order: AttributedOrder): Touchpoint[] {
  return order.touches.map((touch, index) => ({
    id: touch.touchpointId || touch.sessionKey || `session:${order.transactionId}:${index}`,
    timestamp: touch.ts,
    channel: touch.channel,
    source: touch.source ?? undefined,
    medium: touch.medium ?? undefined,
    campaign: touch.campaign ?? undefined,
    ad: touch.adId ?? undefined,
    clickId: touch.fbclid ? "fbclid" : touch.gclid ? "gclid" : null,
    isPaid: isPaidChannel(touch.channel),
    isDirect: isDirectChannel(touch.channel),
  }));
}

export type JourneyStats = {
  touchCount: number;
  firstChannel: string | null;
  lastChannel: string | null;
  daysToConversion: number | null;
  paidTouches: number;
  organicTouches: number;
  directTouches: number;
};

export function journeyStats(order: AttributedOrder): JourneyStats {
  const touches = order.touches;
  if (touches.length === 0) {
    return {
      touchCount: 0,
      firstChannel: null,
      lastChannel: null,
      daysToConversion: null,
      paidTouches: 0,
      organicTouches: 0,
      directTouches: 0,
    };
  }

  let paid = 0;
  let direct = 0;
  let organic = 0;
  for (const touch of touches) {
    if (isDirectChannel(touch.channel)) {
      direct += 1;
    } else if (isPaidChannel(touch.channel)) {
      paid += 1;
    } else {
      organic += 1;
    }
  }

  const firstTs = touches[0].ts;
  const purchaseTs = order.purchaseTs || touches[touches.length - 1].ts;
  const daysToConversion =
    Number.isFinite(firstTs) && Number.isFinite(purchaseTs)
      ? Math.max(0, (purchaseTs - firstTs) / DAY_MS)
      : null;

  return {
    touchCount: touches.length,
    firstChannel: touches[0].channel,
    lastChannel: touches[touches.length - 1].channel,
    daysToConversion,
    paidTouches: paid,
    organicTouches: organic,
    directTouches: direct,
  };
}
