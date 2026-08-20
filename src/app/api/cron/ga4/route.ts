import { handleSourceCron } from "@/lib/cron/handler";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSourceCron(request, "ga4");
}

export async function POST(request: Request) {
  return GET(request);
}
