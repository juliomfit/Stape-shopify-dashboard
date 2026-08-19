import {
  DEFAULT_ATTRIBUTION_WINDOW_DAYS,
  ATTRIBUTION_WINDOW_DAYS,
} from "@/lib/attribution/windows";
import { ATTRIBUTION_POLICY_ID } from "@/lib/attribution/policy";
import { DEFAULT_TIME_DECAY_HALF_LIFE_HOURS } from "@/lib/attribution/engine";

/** Same seven models as attribution_policy_v1. Do not add last_paid/first_paid. */
export const WAREHOUSE_MODELS = [
  { key: "first_touch", label: "First Touch" },
  { key: "last_touch", label: "Last Touch" },
  { key: "last_non_direct", label: "Last Non-Direct" },
  { key: "paid_only", label: "Paid Only" },
  { key: "linear", label: "Linear" },
  { key: "position_based", label: "Position Based" },
  { key: "time_decay", label: "Time Decay" },
] as const;

export type WarehouseModel = (typeof WAREHOUSE_MODELS)[number]["key"];

export const LOOKBACK_DAYS = ATTRIBUTION_WINDOW_DAYS;
export type LookbackDays = (typeof LOOKBACK_DAYS)[number];

export const DEFAULT_MODEL: WarehouseModel = "last_non_direct";
export const DEFAULT_LOOKBACK: LookbackDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS;
export const TIME_DECAY_HALF_LIFE_HOURS = DEFAULT_TIME_DECAY_HALF_LIFE_HOURS;
export const LOGIC_VERSION = ATTRIBUTION_POLICY_ID;

export function isWarehouseModel(value: string | null): value is WarehouseModel {
  return WAREHOUSE_MODELS.some((model) => model.key === value);
}

export function isLookbackDays(value: number): value is LookbackDays {
  return (LOOKBACK_DAYS as readonly number[]).includes(value);
}
