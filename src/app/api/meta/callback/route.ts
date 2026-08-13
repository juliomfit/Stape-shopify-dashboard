import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveMetaCredentials } from "@/lib/ads/meta-credentials";
import {
  clearPendingOAuth,
  exchangeCodeForToken,
  getMetaRedirectUri,
  listAdAccounts,
  META_OAUTH_STATE_COOKIE,
  savePendingOAuth,
} from "@/lib/ads/meta-oauth";

function attributionUrl(query: string) {
  const origin = new URL(getMetaRedirectUri()).origin;
  return new URL(`/attribution?${query}`, origin);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(attributionUrl(`meta=error&reason=${encodeURIComponent(error)}`));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get(META_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(META_OAUTH_STATE_COOKIE);

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(
      attributionUrl("meta=error&reason=login_state"),
    );
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const accounts = await listAdAccounts(accessToken);
    if (accounts.length === 0) {
      await clearPendingOAuth();
      return NextResponse.redirect(
        attributionUrl("meta=error&reason=no_ad_accounts"),
      );
    }

    if (accounts.length === 1) {
      await saveMetaCredentials({
        accessToken,
        adAccountId: accounts[0].id,
      });
      await clearPendingOAuth();
      return NextResponse.redirect(attributionUrl("meta=connected"));
    }

    await savePendingOAuth({ accessToken, accounts });
    return NextResponse.redirect(attributionUrl("meta=pick"));
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Meta login failed";
    return NextResponse.redirect(
      attributionUrl(`meta=error&reason=${encodeURIComponent(message)}`),
    );
  }
}
