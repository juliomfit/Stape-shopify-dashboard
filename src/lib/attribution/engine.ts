/**
 * Canonical first-party attribution engine (pure, deterministic, testable).
 *
 * This is the single TypeScript source of truth for attribution model math.
 * It intentionally mirrors the semantics of the BigQuery warehouse models in
 * `src/lib/warehouse/get-warehouse-metrics.ts` so the dashboard, the order
 * debugger, and any future semantic/AI layer all agree on the numbers.
 *
 * Direct-traffic rules (documented, not scattered):
 * - `first_touch` / `last_touch`: Direct IS eligible (it can win).
 * - `last_non_direct`: skips Direct when any non-direct touch exists; if every
 *   touch is Direct, the last Direct touch wins.
 * - `linear` / `position_based` / `time_decay`: credit only the non-direct
 *   "marketing" touches when any exist; if every touch is Direct, they fall
 *   back to crediting the Direct touches. (Matches the warehouse QUALIFY rule.)
 * - `paid_only`: credit only paid touches; if none are paid, there is no credit.
 *
 * All models return weights that sum to 1 (± floating error) when at least one
 * eligible touch exists, and an empty array otherwise. No NaN/Infinity.
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

export const DEFAULT_POSITION_WEIGHTS: PositionWeights = {
  first: 0.4,
  last: 0.4,
  middle: 0.2,
};

export const DEFAULT_TIME_DECAY_HALF_LIFE_HOURS = 168; // 7 days

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
 * Eligible touches for a model: within the window, at/before purchase, sorted
 * ascending by time, de-duplicated by touchpoint id (earliest wins).
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
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((touch) => {
      if (seen.has(touch.id)) {
        return false;
      }
      seen.add(touch.id);
      return true;
    });
}

/** Non-direct "marketing" touches when any exist, otherwise the direct fallback. */
function marketingTouches(touches: Touchpoint[]): Touchpoint[] {
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
      const eligible = marketingTouches(touches);
      return [credit(eligible[eligible.length - 1], 1)];
    }
    case "linear":
      return linearOver(marketingTouches(touches));
    case "position_based":
      return positionOver(
        marketingTouches(touches),
        options.positionWeights ?? DEFAULT_POSITION_WEIGHTS,
      );
    case "paid_only":
      return linearOver(touches.filter((touch) => touch.isPaid));
    case "time_decay":
      return timeDecayOver(
        marketingTouches(touches),
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
