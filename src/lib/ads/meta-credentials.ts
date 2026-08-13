import {
  getPendingOAuth,
  isMetaOAuthConfigured,
  type MetaAdAccountOption,
} from "@/lib/ads/meta-oauth";
import { clearDurableJson, readDurableJson, writeDurableJson } from "@/lib/durable-json";

export type MetaCredentials = {
  accessToken: string;
  adAccountId: string;
};

export type MetaConnectionPublic = {
  configured: boolean;
  source: "file" | "env" | "none";
  adAccountId: string;
  tokenHint: string;
  canDisconnect: boolean;
  oauthReady: boolean;
  pendingAccounts: MetaAdAccountOption[];
};

type StoredMeta = {
  accessToken?: string;
  adAccountId?: string;
};

function maskToken(token: string) {
  if (token.length <= 8) {
    return "••••";
  }

  return `••••${token.slice(-4)}`;
}

function fromEnv(): MetaCredentials | null {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim() || "";
  const adAccountId = process.env.META_AD_ACCOUNT_ID?.trim() || "";
  if (!accessToken || !adAccountId) {
    return null;
  }

  return { accessToken, adAccountId };
}

async function fromFile(): Promise<MetaCredentials | null> {
  const stored = await readDurableJson<StoredMeta>("meta-ads");
  const accessToken = stored?.accessToken?.trim() || "";
  const adAccountId = stored?.adAccountId?.trim() || "";
  if (!accessToken || !adAccountId) {
    return null;
  }

  return { accessToken, adAccountId };
}

export async function getMetaCredentials(): Promise<{
  credentials: MetaCredentials | null;
  source: MetaConnectionPublic["source"];
}> {
  const file = await fromFile();
  if (file) {
    return { credentials: file, source: "file" };
  }

  const env = fromEnv();
  if (env) {
    return { credentials: env, source: "env" };
  }

  return { credentials: null, source: "none" };
}

export async function getMetaConnectionPublic(): Promise<MetaConnectionPublic> {
  const pending = await getPendingOAuth();
  const oauthReady = isMetaOAuthConfigured();
  const { credentials, source } = await getMetaCredentials();
  if (!credentials) {
    return {
      configured: false,
      source: "none",
      adAccountId: "",
      tokenHint: "",
      canDisconnect: false,
      oauthReady,
      pendingAccounts: pending?.accounts ?? [],
    };
  }

  return {
    configured: true,
    source,
    adAccountId: credentials.adAccountId.replace(/^act_/, ""),
    tokenHint: maskToken(credentials.accessToken),
    canDisconnect: source === "file",
    oauthReady,
    pendingAccounts: pending?.accounts ?? [],
  };
}

export async function saveMetaCredentials(credentials: MetaCredentials) {
  await writeDurableJson("meta-ads", {
    accessToken: credentials.accessToken,
    adAccountId: credentials.adAccountId.replace(/^act_/, ""),
  });
}

export async function clearMetaCredentials() {
  await clearDurableJson("meta-ads");
}
