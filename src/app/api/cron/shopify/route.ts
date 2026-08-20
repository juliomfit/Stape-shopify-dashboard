import { handleSourceCron } from "@/lib/cron/handler";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSourceCron(request, "shopify");
}

export async function POST(request: Request) {
  return GET(request);
}
