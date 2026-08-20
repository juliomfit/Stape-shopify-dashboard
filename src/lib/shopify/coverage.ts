import { readDurableJson, writeDurableJson } from "../durable-json.ts";

const STORE = "shopify-warehouse-coverage";

export type ShopifyWarehouseCoverage = {
  minDate: string | null;
  maxDate: string | null;
  populatedAt: string | null;
};

export function emptyShopifyCoverage(): ShopifyWarehouseCoverage {
  return { minDate: null, maxDate: null, populatedAt: null };
}

export async function readShopifyWarehouseCoverage(): Promise<ShopifyWarehouseCoverage> {
  return (await readDurableJson<ShopifyWarehouseCoverage>(STORE)) ?? emptyShopifyCoverage();
}

export async function expandShopifyWarehouseCoverage(
  startDate: string,
  endDate: string,
): Promise<ShopifyWarehouseCoverage> {
  const current = await readShopifyWarehouseCoverage();
  const minDate = current.minDate
    ? current.minDate < startDate
      ? current.minDate
      : startDate
    : startDate;
  const maxDate = current.maxDate
    ? current.maxDate > endDate
      ? current.maxDate
      : endDate
    : endDate;
  const next: ShopifyWarehouseCoverage = {
    minDate,
    maxDate,
    populatedAt: new Date().toISOString(),
  };
  await writeDurableJson(STORE, next);
  return next;
}

export function warehouseCoversPeriod(
  coverage: ShopifyWarehouseCoverage,
  startDate: string,
  endDate: string,
): boolean {
  if (!coverage.minDate || !coverage.maxDate) return false;
  return coverage.minDate <= startDate && coverage.maxDate >= endDate;
}
