import { NextResponse } from "next/server";
import { askGoodsNovaAi } from "@/lib/ai/run";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    question?: string;
    viewContext?: string;
  };
  const question = (body.question || "").trim();
  if (!question || question.length > 4000) {
    return NextResponse.json(
      { ok: false, text: "Ask a question (max 4000 characters)." },
      { status: 400 },
    );
  }
  const result = await askGoodsNovaAi({
    question,
    viewContext: body.viewContext?.slice(0, 2000),
  });
  return NextResponse.json(result);
}
