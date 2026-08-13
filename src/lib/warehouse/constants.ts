export const WAREHOUSE_MODELS = [
  { key: "first_touch", label: "First Touch" },
  { key: "last_touch", label: "Last Touch" },
  { key: "last_non_direct", label: "Last Non-Direct" },
  { key: "last_paid", label: "Last Paid" },
  { key: "first_paid", label: "First Paid" },
  { key: "linear", label: "Linear" },
  { key: "position_based", label: "Position Based" },
  { key: "time_decay", label: "Time Decay" },
] as const;

export type WarehouseModel = (typeof WAREHOUSE_MODELS)[number]["key"];

export const LOOKBACK_DAYS = [1, 7, 14, 28, 30, 60, 90] as const;
export type LookbackDays = (typeof LOOKBACK_DAYS)[number];

export const DEFAULT_MODEL: WarehouseModel = "last_non_direct";
export const DEFAULT_LOOKBACK: LookbackDays = 30;
export const TIME_DECAY_HALF_LIFE_HOURS = 168;
export const LOGIC_VERSION = "v1";

export function isWarehouseModel(value: string | null): value is WarehouseModel {
  return WAREHOUSE_MODELS.some((model) => model.key === value);
}

export function isLookbackDays(value: number): value is LookbackDays {
  return (LOOKBACK_DAYS as readonly number[]).includes(value);
}
