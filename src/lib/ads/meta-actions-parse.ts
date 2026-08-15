export type MetaAction = { action_type?: string; value?: string };

const PURCHASE_TYPES = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "web_in_store_purchase",
];

const ATC_TYPES = [
  "add_to_cart",
  "omni_add_to_cart",
  "offsite_conversion.fb_pixel_add_to_cart",
];

const CHECKOUT_TYPES = [
  "initiate_checkout",
  "omni_initiated_checkout",
  "offsite_conversion.fb_pixel_initiate_checkout",
];

const LPV_TYPES = [
  "landing_page_view",
  "omni_landing_page_view",
];

function pick(actions: MetaAction[] | undefined, types: string[]) {
  for (const type of types) {
    const match = actions?.find((action) => action.action_type === type);
    if (match?.value) {
      const amount = Number(match.value);
      if (Number.isFinite(amount)) {
        return amount;
      }
    }
  }
  return 0;
}

export function purchaseCount(actions?: MetaAction[]) {
  return pick(actions, PURCHASE_TYPES);
}

export function purchaseValue(actionValues?: MetaAction[]) {
  return pick(actionValues, PURCHASE_TYPES);
}

export function addToCartCount(actions?: MetaAction[]) {
  return pick(actions, ATC_TYPES);
}

export function checkoutCount(actions?: MetaAction[]) {
  return pick(actions, CHECKOUT_TYPES);
}

export function landingPageViews(actions?: MetaAction[]) {
  return pick(actions, LPV_TYPES);
}

export function flattenActions(
  actions: MetaAction[] | undefined,
  kind: "count" | "value",
) {
  return (actions || [])
    .filter((row) => row.action_type && row.value)
    .map((row) => ({
      action_kind: kind,
      action_type: String(row.action_type),
      action_value: Number(row.value),
    }))
    .filter((row) => Number.isFinite(row.action_value));
}

export function num(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}
