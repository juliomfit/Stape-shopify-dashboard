/**
 * Deterministic Meta vs Flyweel ID namespace guard.
 *
 * Browser / GTM IDs (`gn_meta_campaign_id` / `{{campaign.id}}`) are native
 * Meta numeric IDs. Flyweel query_metrics `campaign_id` values in production
 * are Flyweel-internal UUIDs. Equal strings across those namespaces must not
 * become HIGH campaign_id_exact. No fuzzy mapping.
 */

const NATIVE_META_NUMERIC_ID = /^[0-9]{1,32}$/;
const FLYWEEL_INTERNAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isNativeMetaNumericId(value: string | null | undefined): boolean {
  if (value == null) return false;
  return NATIVE_META_NUMERIC_ID.test(String(value).trim());
}

export function isFlyweelInternalUuid(value: string | null | undefined): boolean {
  if (value == null) return false;
  return FLYWEEL_INTERNAL_UUID.test(String(value).trim());
}

export function campaignIdExactMatchAllowed(
  observedId: string | null | undefined,
  factId: string | null | undefined,
): boolean {
  const observed = String(observedId ?? "").trim();
  const fact = String(factId ?? "").trim();
  if (!observed || !fact) return false;
  if (observed !== fact) return false;
  if (isFlyweelInternalUuid(fact) || isFlyweelInternalUuid(observed)) return false;
  return isNativeMetaNumericId(observed) && isNativeMetaNumericId(fact);
}

export function warehouseCampaignIdsAreNativeMeta(
  factIds: Iterable<string | null | undefined>,
): boolean {
  let sawNative = false;
  for (const id of factIds) {
    if (isFlyweelInternalUuid(id)) return false;
    if (isNativeMetaNumericId(id)) sawNative = true;
  }
  return sawNative;
}
