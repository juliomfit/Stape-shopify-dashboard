import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getShopifyConfig } from "@/lib/shopify/config";
import { finishSyncRun, startSyncRun } from "@/lib/platform/sync-runs";
import { revalidatePath } from "next/cache";
import { invalidateCachedSources } from "@/lib/cache/invalidate";

export const dynamic = "force-dynamic";

function validHmac(rawBody: string, header: string | null, secret: string) {
  if (!header) {
    return false;
  }
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const left = Buffer.from(digest);
  const right = Buffer.from(header);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const config = getShopifyConfig();
  if (!config) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const raw = await request.text();
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET?.trim() || config.clientSecret;
  const hmac = request.headers.get("x-shopify-hmac-sha256");
  if (!validHmac(raw, hmac, secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const topic = request.headers.get("x-shopify-topic") || "unknown";
  const run = await startSyncRun({
    source: "shopify",
    syncType: `webhook:${topic}`,
  });
  await finishSyncRun(run, { status: "completed", records_inserted: 1 });
  await invalidateCachedSources("shopify", { mode: "hard" });
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
