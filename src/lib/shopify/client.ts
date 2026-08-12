import { getShopifyConfig } from "@/lib/shopify/config";

type TokenCache = {
  shop: string;
  accessToken: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

async function getAccessToken() {
  const config = getShopifyConfig();

  if (!config) {
    throw new Error("Shopify is not configured.");
  }

  if (
    tokenCache &&
    tokenCache.shop === config.shop &&
    Date.now() < tokenCache.expiresAt - 60_000
  ) {
    return { config, accessToken: tokenCache.accessToken };
  }

  const response = await fetch(
    `https://${config.shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
      cache: "no-store",
    },
  );

  const payload = (await response.json()) as TokenResponse;

  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        `Shopify login failed (${response.status}).`,
    );
  }

  tokenCache = {
    shop: config.shop,
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 86399) * 1000,
  };

  return { config, accessToken: payload.access_token };
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function shopifyGraphql<T>(
  query: string,
  variables?: Record<string, unknown>,
) {
  const { config, accessToken } = await getAccessToken();

  const response = await fetch(
    `https://${config.shop}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(`Shopify request failed (${response.status}).`);
  }

  const payload = (await response.json()) as GraphQLResponse<T>;

  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join(" "));
  }

  if (!payload.data) {
    throw new Error("Shopify returned no data.");
  }

  return payload.data;
}
