import { readDurableJson, writeDurableJson } from "@/lib/durable-json";
import { DASHBOARD_TZ } from "@/lib/period";
import { reportingCurrency } from "@/lib/platform/config";

export type BusinessContext = {
  business: string;
  primaryProduct: string;
  targetCpa: number | null;
  targetMer: number | null;
  targetContributionMargin: number | null;
  typicalCogs: number | null;
  shippingCostAssumption: number | null;
  paidChannels: string;
  primaryConversion: string;
  timezone: string;
  currency: string;
};

const DEFAULTS: BusinessContext = {
  business: "GoodsNova",
  primaryProduct: "InstaFrame",
  targetCpa: null,
  targetMer: null,
  targetContributionMargin: null,
  typicalCogs: null,
  shippingCostAssumption: null,
  paidChannels: "Meta Ads, Google Ads",
  primaryConversion: "Shopify purchase",
  timezone: DASHBOARD_TZ,
  currency: reportingCurrency(),
};

export async function getBusinessContext(): Promise<BusinessContext> {
  const stored = await readDurableJson<Partial<BusinessContext>>("business-context");
  return { ...DEFAULTS, ...stored, timezone: DASHBOARD_TZ };
}

export async function saveBusinessContext(
  patch: Partial<BusinessContext>,
): Promise<BusinessContext> {
  const next = { ...(await getBusinessContext()), ...patch, timezone: DASHBOARD_TZ };
  await writeDurableJson("business-context", next);
  return next;
}
