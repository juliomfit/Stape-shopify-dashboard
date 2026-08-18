/**
 * Central channel taxonomy helpers for the TypeScript attribution engine.
 *
 * The channel *names* and paid/organic membership are owned by
 * `src/lib/stape/channel-sql.ts` (which also drives the BigQuery
 * classification). This module re-exports them and adds the paid/direct
 * predicates the engine needs, so the "which channels are paid / direct"
 * rules live in exactly one place.
 */
import {
  ATTRIBUTION_CHANNELS,
  PAID_CHANNELS,
  ORGANIC_CHANNELS,
  type AttributionChannel,
} from "@/lib/stape/channel-sql";

export { ATTRIBUTION_CHANNELS, PAID_CHANNELS, ORGANIC_CHANNELS };
export type { AttributionChannel };

export const DIRECT_CHANNEL = "Direct";
export const UNKNOWN_CHANNEL = "Unknown";

const PAID_SET = new Set<string>(PAID_CHANNELS);

export function isPaidChannel(channel: string): boolean {
  return PAID_SET.has(channel);
}

export function isDirectChannel(channel: string): boolean {
  return channel === DIRECT_CHANNEL;
}
