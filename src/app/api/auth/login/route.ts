import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import {
  GATE_COOKIE,
  dashboardPassword,
  gateToken,
} from "@/lib/dashboard-gate";

function passwordsMatch(submitted: string, expected: string) {
  const left = Buffer.from(submitted);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const password = dashboardPassword();
  const form = await request.formData();
  const submitted = String(form.get("password") || "");
  const nextPath = String(form.get("next") || "/");
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";
  const origin = new URL(request.url).origin;

  if (!password || !passwordsMatch(submitted, password)) {
    return NextResponse.redirect(
      new URL(`/login?error=1&next=${encodeURIComponent(safeNext)}`, origin),
    );
  }

  const response = NextResponse.redirect(new URL(safeNext, origin));
  response.cookies.set(GATE_COOKIE, await gateToken(password), {
    httpOnly: true,
    secure: process.env.VERCEL ? true : false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
