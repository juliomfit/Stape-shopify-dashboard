import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, dashboardPassword, gateCookieMatches } from "@/lib/dashboard-gate";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const password = dashboardPassword();
  const onVercel = Boolean(process.env.VERCEL);

  if (onVercel && !password) {
    return new NextResponse(
      "Set DASHBOARD_PASSWORD in Vercel Project Settings → Environment Variables (Production and Preview), then redeploy.",
      {
        status: 401,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    );
  }

  if (!password) {
    return NextResponse.next();
  }

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/shopify/webhooks") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (await gateCookieMatches(request.cookies.get(GATE_COOKIE)?.value, password)) {
    return NextResponse.next();
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
