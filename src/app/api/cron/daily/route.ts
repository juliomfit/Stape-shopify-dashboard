import { handleSourceCron } from "@/lib/cron/handler";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleSourceCron(request, "daily");
}

export async function POST(request: Request) {
  return GET(request);
}
