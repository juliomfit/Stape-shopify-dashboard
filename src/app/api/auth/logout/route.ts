import { NextResponse } from "next/server";
import { GATE_COOKIE } from "@/lib/dashboard-gate";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(new URL("/login", origin));
  response.cookies.delete(GATE_COOKIE);
  return response;
}
