import { percentChange } from "@/lib/metrics/formulas";
import { writeDurableJson } from "@/lib/durable-json";
import { insertRows, isPlatformBqReady } from "@/lib/platform/bq";
import { randomUUID } from "crypto";

export type Anomaly = {
  id: string;
  metric: string;
  entity_type: string;
  entity_id: string;
  current_value: number | null;
  baseline_value: number | null;
  delta_percent: number | null;
  severity: "warning" | "critical";
  detected_at: string;
  resolved_at: string | null;
  context: string;
};

const THRESHOLD = 0.25;

function check(
  metric: string,
  current: number | null,
  baseline: number | null,
  context: string,
  invert = false,
): Anomaly | null {
  const delta = percentChange(current, baseline);
  if (delta === null) {
    return null;
  }
  const bad = invert ? delta < -THRESHOLD : delta > THRESHOLD;
  const alsoBad = invert ? false : delta < -THRESHOLD && metric !== "spend";
  if (!bad && !alsoBad) {
    return null;
  }
  if (Math.abs(delta) < THRESHOLD) {
    return null;
  }
  return {
    id: randomUUID(),
    metric,
    entity_type: "account",
    entity_id: "goodsnova",
    current_value: current,
    baseline_value: baseline,
    delta_percent: delta,
    severity: Math.abs(delta) >= 0.5 ? "critical" : "warning",
    detected_at: new Date().toISOString(),
    resolved_at: null,
    context,
  };
}

export function computeAnomalies(input: {
  revenue: number | null;
  previousRevenue: number | null;
  orders: number | null;
  previousOrders: number | null;
  spend: number | null;
  previousSpend: number | null;
  mer: number | null;
  previousMer: number | null;
  cpa: number | null;
  previousCpa: number | null;
  conversion: number | null;
  previousConversion: number | null;
  metaCpa: number | null;
  previousMetaCpa: number | null;
}): Anomaly[] {
  return [
    check("revenue", input.revenue, input.previousRevenue, "Shopify total revenue", true),
    check("orders", input.orders, input.previousOrders, "Shopify orders", true),
    check("spend", input.spend, input.previousSpend, "Blended ad spend"),
    check("cpa", input.cpa, input.previousCpa, "Blended CPA"),
    check("mer", input.mer, input.previousMer, "MER (spend ÷ revenue)"),
    check(
      "conversion",
      input.conversion,
      input.previousConversion,
      "Shopify orders ÷ Stape sessions",
      true,
    ),
    check("meta_cpa", input.metaCpa, input.previousMetaCpa, "Meta platform CPA"),
  ].filter((row): row is Anomaly => row !== null);
}

export async function detectAnomalies(
  input: Parameters<typeof computeAnomalies>[0],
  options?: { persist?: boolean },
): Promise<Anomaly[]> {
  const found = computeAnomalies(input);
  if (options?.persist === false) {
    return found;
  }

  try {
    await writeDurableJson("analytics-anomalies", { rows: found });
  } catch {
    // ignore
  }
  if (isPlatformBqReady() && found.length > 0) {
    try {
      await insertRows(
        "analytics_anomalies",
        found.map((row) => ({ ...row, context: row.context })),
      );
    } catch {
      // ignore
    }
  }
  return found;
}
