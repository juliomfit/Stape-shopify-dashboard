/**
 * Canonical first-party attribution engine (pure, deterministic, testable).
 *
 * Contract: `src/lib/attribution/policy.ts` (`attribution_policy_v1`).
 * BigQuery warehouse SQL must match these formulas. Tests fail on disagreement.
 *
 * Direct / Unknown (mandatory):
 * - Unknown ≠ Direct. Missing tracking stays Unknown / unattributed.
 * - Direct is a real eligible touch for first, last, linear, position, time-decay.
 * - `last_non_direct`: skips Direct when any non-direct exists; if every touch
 *   is Direct, the last Direct wins.
 * - `paid_only`: paid touches only; empty credit (unattributed) when none exist.
 *
 * All models return weights that sum to 1 (± 1e-9) when at least one eligible
 * touch exists, and an empty array otherwise. No NaN/Infinity.
 */

export const ATTRIBUTION_MODELS = [
  "first_touch",
  "last_touch",
  "last_non_direct",
  "linear",
  "position_based",
  "paid_only",
  "time_decay",
] as const;

export type AttributionModel = (typeof ATTRIBUTION_MODELS)[number];

export const ATTRIBUTION_MODEL_LABELS: Record<AttributionModel, string> = {
  first_touch: "First touch",
  last_touch: "Last touch",
  last_non_direct: "Last non-direct",
  linear: "Linear",
  position_based: "Position based",
  paid_only: "Paid only (linear)",
  time_decay: "Time decay",
};

export type Touchpoint = {
  id: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
  channel: string;
  source?: string;
  medium?: string;
  campaign?: string;
  ad?: string;
  clickId?: string | null;
  isPaid: boolean;
  isDirect: boolean;
  type?: "click" | "view";
};

export type Credit = {
  touchpointId: string;
  channel: string;
  /** Fraction of the order credited to this touch (0..1). */
  weight: number;
};

export type PositionWeights = {
  first: number;
  last: number;
  middle: number;
};

/** Must match attribution_policy_v1 POSITION_WEIGHTS. */
export const DEFAULT_POSITION_WEIGHTS: PositionWeights = {
  first: 0.4,
  last: 0.4,
  middle: 0.2,
};

/** Must match attribution_policy_v1 TIME_DECAY_HALF_LIFE_HOURS. */
export const DEFAULT_TIME_DECAY_HALF_LIFE_HOURS = 168;

export type AttributeOptions = {
  model: AttributionModel;
  /** Unix epoch milliseconds of the order/conversion. */
  purchaseTs: number;
  /** Touches older than this many days before the purchase are excluded. */
  windowDays?: number;
  positionWeights?: PositionWeights;
  timeDecayHalfLifeHours?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deterministic journey order. Matches BigQuery winner-take-all QUALIFY:
 * timestamp first, then touchpoint_id so same-timestamp ties never split 100% credit.
 */
export function compareTouchpoints(a: Touchpoint, b: Touchpoint): number {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  return a.id.localeCompare(b.id);
}

/**
 * Eligible touches for a model: within the window, at/before purchase, sorted
 * ascending by time then id, de-duplicated by touchpoint id (earliest wins).
 */
export function eligibleTouches(
  touchpoints: Touchpoint[],
  purchaseTs: number,
  windowDays?: number,
): Touchpoint[] {
  const cutoff =
    windowDays && windowDays > 0 ? purchaseTs - windowDays * DAY_MS : -Infinity;
  const seen = new Set<string>();
  return touchpoints
    .filter(
      (touch) =>
        Number.isFinite(touch.timestamp) &&
        touch.timestamp <= purchaseTs &&
        touch.timestamp >= cutoff,
    )
    .sort(compareTouchpoints)
    .filter((touch) => {
      if (seen.has(touch.id)) {
        return false;
      }
      seen.add(touch.id);
      return true;
    });
}

/** First non-direct in chronological (timestamp, id) order. */
export function firstNonDirectTouch(touches: Touchpoint[]): Touchpoint | undefined {
  return touches.find((touch) => !touch.isDirect);
}

/** Last non-direct in chronological (timestamp, id) order. */
export function lastNonDirectTouch(touches: Touchpoint[]): Touchpoint | undefined {
  for (let index = touches.length - 1; index >= 0; index -= 1) {
    if (!touches[index].isDirect) {
      return touches[index];
    }
  }
  return undefined;
}

/** Non-direct touches when any exist, otherwise the Direct fallback (last_non_direct only). */
function lastNonDirectTouches(touches: Touchpoint[]): Touchpoint[] {
  const nonDirect = touches.filter((touch) => !touch.isDirect);
  return nonDirect.length > 0 ? nonDirect : touches;
}

function credit(touch: Touchpoint, weight: number): Credit {
  return { touchpointId: touch.id, channel: touch.channel, weight };
}

function linearOver(touches: Touchpoint[]): Credit[] {
  if (touches.length === 0) {
    return [];
  }
  const weight = 1 / touches.length;
  return touches.map((touch) => credit(touch, weight));
}

function positionOver(touches: Touchpoint[], weights: PositionWeights): Credit[] {
  const n = touches.length;
  if (n === 0) {
    return [];
  }
  if (n === 1) {
    return [credit(touches[0], 1)];
  }
  if (n === 2) {
    const total = weights.first + weights.last || 1;
    return [
      credit(touches[0], weights.first / total),
      credit(touches[1], weights.last / total),
    ];
  }
  const middleEach = weights.middle / (n - 2);
  return touches.map((touch, index) => {
    if (index === 0) {
      return credit(touch, weights.first);
    }
    if (index === n - 1) {
      return credit(touch, weights.last);
    }
    return credit(touch, middleEach);
  });
}

function timeDecayOver(
  touches: Touchpoint[],
  purchaseTs: number,
  halfLifeHours: number,
): Credit[] {
  if (touches.length === 0) {
    return [];
  }
  const halfLife = halfLifeHours > 0 ? halfLifeHours : DEFAULT_TIME_DECAY_HALF_LIFE_HOURS;
  const raw = touches.map((touch) => {
    const hours = Math.max(0, (purchaseTs - touch.timestamp) / (60 * 60 * 1000));
    return Math.pow(2, -hours / halfLife);
  });
  const total = raw.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return linearOver(touches);
  }
  return touches.map((touch, index) => credit(touch, raw[index] / total));
}

/** Compute fractional credit for one model over one journey. */
export function attribute(
  touchpoints: Touchpoint[],
  options: AttributeOptions,
): Credit[] {
  const touches = eligibleTouches(touchpoints, options.purchaseTs, options.windowDays);
  if (touches.length === 0) {
    return [];
  }

  switch (options.model) {
    case "first_touch":
      return [credit(touches[0], 1)];
    case "last_touch":
      return [credit(touches[touches.length - 1], 1)];
    case "last_non_direct": {
      const eligible = lastNonDirectTouches(touches);
      return [credit(eligible[eligible.length - 1], 1)];
    }
    case "linear":
      return linearOver(touches);
    case "position_based":
      return positionOver(touches, options.positionWeights ?? DEFAULT_POSITION_WEIGHTS);
    case "paid_only":
      return linearOver(touches.filter((touch) => touch.isPaid));
    case "time_decay":
      return timeDecayOver(
        touches,
        options.purchaseTs,
        options.timeDecayHalfLifeHours ?? DEFAULT_TIME_DECAY_HALF_LIFE_HOURS,
      );
    default:
      return [];
  }
}

/** Roll fractional touch credit up to channel-level weights for one model. */
export function creditByChannel(credits: Credit[]): Record<string, number> {
  const byChannel: Record<string, number> = {};
  for (const item of credits) {
    byChannel[item.channel] = (byChannel[item.channel] ?? 0) + item.weight;
  }
  return byChannel;
}

/** Run every model over one journey (used by the order attribution debugger). */
export function attributeAllModels(
  touchpoints: Touchpoint[],
  options: Omit<AttributeOptions, "model">,
): Record<AttributionModel, Credit[]> {
  const result = {} as Record<AttributionModel, Credit[]>;
  for (const model of ATTRIBUTION_MODELS) {
    result[model] = attribute(touchpoints, { ...options, model });
  }
  return result;
}

// --- Cross-order rollups (model comparison) ------------------------------

export type OrderInput = {
  id: string;
  revenue: number;
  purchaseTs: number;
  touchpoints: Touchpoint[];
};

/** Attributed revenue and fractional ("equivalent") orders for one channel. */
export type ChannelCell = {
  revenue: number;
  orders: number;
};

export type RollupOptions = {
  model: AttributionModel;
  windowDays?: number;
  positionWeights?: PositionWeights;
  timeDecayHalfLifeHours?: number;
};

/**
 * Aggregate attributed revenue and fractional orders by channel for one model
 * across many orders. Fractional orders are the summed touch credit weights, so
 * they add up to the number of attributed orders (never double-counted).
 */
export function attributeOrdersByChannel(
  orders: OrderInput[],
  options: RollupOptions,
): Record<string, ChannelCell> {
  const out: Record<string, ChannelCell> = {};
  for (const order of orders) {
    const credits = attribute(order.touchpoints, {
      model: options.model,
      purchaseTs: order.purchaseTs,
      windowDays: options.windowDays,
      positionWeights: options.positionWeights,
      timeDecayHalfLifeHours: options.timeDecayHalfLifeHours,
    });
    for (const item of credits) {
      const cell = out[item.channel] ?? { revenue: 0, orders: 0 };
      cell.revenue += item.weight * order.revenue;
      cell.orders += item.weight;
      out[item.channel] = cell;
    }
  }
  return out;
}

export type ModelComparison = {
  channels: string[];
  models: AttributionModel[];
  /** cells[model][channel] */
  cells: Record<AttributionModel, Record<string, ChannelCell>>;
  totalsByModel: Record<AttributionModel, ChannelCell>;
};

/**
 * Build a channel × model matrix of attributed revenue/orders. Channels are the
 * union across all models, ordered by descending revenue under the first model.
 */
export function compareModels(
  orders: OrderInput[],
  models: AttributionModel[],
  options: Omit<RollupOptions, "model"> = {},
): ModelComparison {
  const cells = {} as Record<AttributionModel, Record<string, ChannelCell>>;
  const totalsByModel = {} as Record<AttributionModel, ChannelCell>;
  const channelSet = new Set<string>();

  for (const model of models) {
    const byChannel = attributeOrdersByChannel(orders, { ...options, model });
    cells[model] = byChannel;
    let revenue = 0;
    let orderTotal = 0;
    for (const [channel, cell] of Object.entries(byChannel)) {
      channelSet.add(channel);
      revenue += cell.revenue;
      orderTotal += cell.orders;
    }
    totalsByModel[model] = { revenue, orders: orderTotal };
  }

  const reference = models[0];
  const channels = [...channelSet].sort(
    (a, b) =>
      (cells[reference]?.[b]?.revenue ?? 0) - (cells[reference]?.[a]?.revenue ?? 0),
  );

  return { channels, models, cells, totalsByModel };
}

/**
 * Real assists: eligible touches that are neither first nor last on the
 * converting path. Empty when the journey has fewer than 3 eligible touches.
 * Credit is an equal split among assist touches (not Linear-including-ends).
 */
export function assistCredits(
  touchpoints: Touchpoint[],
  purchaseTs: number,
  windowDays?: number,
): Credit[] {
  const touches = eligibleTouches(touchpoints, purchaseTs, windowDays);
  if (touches.length < 3) {
    return [];
  }
  return linearOver(touches.slice(1, -1));
}

export type OrderCredit = Credit & { attributedRevenue: number };

export function applyRevenue(credits: Credit[], eligibleRevenue: number): OrderCredit[] {
  return credits.map((item) => ({
    ...item,
    attributedRevenue: item.weight * eligibleRevenue,
  }));
}

const CREDIT_EPS = 1e-9;

export function orderCreditIntegrity(
  credits: Credit[],
  eligibleRevenue: number,
): { ok: boolean; weightSum: number; attributedRevenue: number } {
  const weightSum = credits.reduce((sum, item) => sum + item.weight, 0);
  const attributedRevenue = credits.reduce(
    (sum, item) => sum + item.weight * eligibleRevenue,
    0,
  );
  const ok =
    credits.length === 0
      ? true
      : Math.abs(weightSum - 1) < CREDIT_EPS &&
        Math.abs(attributedRevenue - eligibleRevenue) <
          Math.max(CREDIT_EPS, Math.abs(eligibleRevenue) * 1e-9);
  return { ok, weightSum, attributedRevenue };
}
