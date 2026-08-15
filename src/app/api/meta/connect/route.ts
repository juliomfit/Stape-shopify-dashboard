import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createOAuthState,
  getMetaLoginUrl,
  isMetaOAuthConfigured,
  META_OAUTH_STATE_COOKIE,
} from "@/lib/ads/meta-oauth";

export async function GET(request: Request) {
  if (!isMetaOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/integrations?meta=error&reason=missing_app", request.url),
    );
  }

  const state = createOAuthState();
  (await cookies()).set(META_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return NextResponse.redirect(getMetaLoginUrl(state));
}
