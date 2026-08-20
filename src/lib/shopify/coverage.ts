import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const DISK_FILE = path.join(process.cwd(), "secrets", "shopify-warehouse-coverage.json");

export type ShopifyWarehouseCoverage = {
  minDate: string | null;
  maxDate: string | null;
  populatedAt: string | null;
};

export function emptyShopifyCoverage(): ShopifyWarehouseCoverage {
  return { minDate: null, maxDate: null, populatedAt: null };
}

export function warehouseCoversPeriod(
  coverage: ShopifyWarehouseCoverage,
  startDate: string,
  endDate: string,
): boolean {
  if (!coverage.minDate || !coverage.maxDate) return false;
  return coverage.minDate <= startDate && coverage.maxDate >= endDate;
}

/**
 * Serve prepared warehouse facts whenever they exist for the period.
 * Checkpoint coverage is only required to treat a true empty range as
 * warehouse-backed (no Admin fallback) instead of "not loaded yet".
 */
export function warehouseReadDecision(input: {
  coverage: ShopifyWarehouseCoverage;
  startDate: string;
  endDate: string;
  rowCount: number;
}): "use" | "empty-covered" | "fallback" {
  if (input.rowCount > 0) return "use";
  if (warehouseCoversPeriod(input.coverage, input.startDate, input.endDate)) {
    return "empty-covered";
  }
  return "fallback";
}

export function mergeCoverageRange(
  current: ShopifyWarehouseCoverage,
  startDate: string,
  endDate: string,
  populatedAt: string,
): ShopifyWarehouseCoverage {
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
  return { minDate, maxDate, populatedAt };
}

function parseCoverage(raw: string): ShopifyWarehouseCoverage | null {
  try {
    const parsed = JSON.parse(raw) as ShopifyWarehouseCoverage;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      minDate: parsed.minDate ?? null,
      maxDate: parsed.maxDate ?? null,
      populatedAt: parsed.populatedAt ?? null,
    };
  } catch {
    return null;
  }
}

/** Local/dev fallback only. Production coverage lives in BigQuery. Never cookies. */
export async function readCoverageFromDisk(): Promise<ShopifyWarehouseCoverage> {
  try {
    return parseCoverage(await readFile(DISK_FILE, "utf8")) ?? emptyShopifyCoverage();
  } catch {
    return emptyShopifyCoverage();
  }
}

export async function writeCoverageToDisk(coverage: ShopifyWarehouseCoverage): Promise<void> {
  await mkdir(path.dirname(DISK_FILE), { recursive: true });
  await writeFile(DISK_FILE, `${JSON.stringify(coverage)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}
