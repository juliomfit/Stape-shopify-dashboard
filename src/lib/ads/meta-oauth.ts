import { randomBytes } from "crypto";
import { clearDurableJson, readDurableJson, writeDurableJson } from "@/lib/durable-json";

const GRAPH = "https://graph.facebook.com/v21.0";

export const META_OAUTH_STATE_COOKIE = "meta_oauth_state";

export type MetaAdAccountOption = {
  id: string;
  name: string;
};

type PendingOAuth = {
  accessToken: string;
  accounts: MetaAdAccountOption[];
};

export function isMetaOAuthConfigured() {
  return Boolean(
    process.env.META_APP_ID?.trim() && process.env.META_APP_SECRET?.trim(),
  );
}

export function getMetaRedirectUri() {
  const explicit =
    process.env.META_REDIRECT_URI?.trim() ||
    process.env.META_OAUTH_REDIRECT_URI?.trim();
  if (explicit) {
    return explicit;
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) {
    return `https://${production.replace(/^https?:\/\//, "")}/api/meta/callback`;
  }

  const preview = process.env.VERCEL_URL?.trim();
  if (preview) {
    return `https://${preview.replace(/^https?:\/\//, "")}/api/meta/callback`;
  }

  return "http://localhost:3000/api/meta/callback";
}

export function createOAuthState() {
  return randomBytes(16).toString("hex");
}

export function getMetaLoginUrl(state: string) {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.META_APP_ID?.trim() || "");
  url.searchParams.set("redirect_uri", getMetaRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "ads_read,ads_management");
  return url.toString();
}

async function graphGet<T>(url: URL): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const payload = (await response.json()) as T & {
    error?: { message?: string };
  };
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `Meta OAuth failed (${response.status})`);
  }
  return payload;
}

export async function exchangeCodeForToken(code: string) {
  const appId = process.env.META_APP_ID?.trim() || "";
  const appSecret = process.env.META_APP_SECRET?.trim() || "";
  const shortLived = new URL(`${GRAPH}/oauth/access_token`);
  shortLived.searchParams.set("client_id", appId);
  shortLived.searchParams.set("client_secret", appSecret);
  shortLived.searchParams.set("redirect_uri", getMetaRedirectUri());
  shortLived.searchParams.set("code", code);

  const short = await graphGet<{ access_token?: string }>(shortLived);
  if (!short.access_token) {
    throw new Error("Meta did not return an access token.");
  }

  const longLived = new URL(`${GRAPH}/oauth/access_token`);
  longLived.searchParams.set("grant_type", "fb_exchange_token");
  longLived.searchParams.set("client_id", appId);
  longLived.searchParams.set("client_secret", appSecret);
  longLived.searchParams.set("fb_exchange_token", short.access_token);

  try {
    const long = await graphGet<{ access_token?: string }>(longLived);
    return long.access_token || short.access_token;
  } catch {
    return short.access_token;
  }
}

export async function listAdAccounts(
  accessToken: string,
): Promise<MetaAdAccountOption[]> {
  const url = new URL(`${GRAPH}/me/adaccounts`);
  url.searchParams.set("fields", "account_id,name,account_status");
  url.searchParams.set("limit", "50");
  url.searchParams.set("access_token", accessToken);

  const payload = await graphGet<{
    data?: { account_id?: string; name?: string; account_status?: number }[];
  }>(url);

  return (payload.data || [])
    .filter((row) => row.account_id)
    .map((row) => ({
      id: String(row.account_id),
      name: row.name || String(row.account_id),
    }));
}

export async function savePendingOAuth(pending: PendingOAuth) {
  await writeDurableJson("meta-oauth-pending", pending);
}

export async function getPendingOAuth(): Promise<PendingOAuth | null> {
  return readDurableJson<PendingOAuth>("meta-oauth-pending");
}

export async function clearPendingOAuth() {
  await clearDurableJson("meta-oauth-pending");
}
