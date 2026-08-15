import { getBigQueryConfig } from "@/lib/stape/config";

export function platformDataset() {
  return process.env.BIGQUERY_PLATFORM_DATASET?.trim() || "goodsnova_platform";
}

export function reportingCurrency() {
  return process.env.REPORTING_CURRENCY?.trim() || "USD";
}

export function metaApiVersion() {
  const raw = process.env.META_API_VERSION?.trim() || "v21.0";
  return raw.startsWith("v") ? raw : `v${raw}`;
}

export function metaRedirectUri() {
  return (
    process.env.META_REDIRECT_URI?.trim() ||
    process.env.META_OAUTH_REDIRECT_URI?.trim() ||
    ""
  );
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function cronSecret() {
  return process.env.CRON_SECRET?.trim() || "";
}

export function platformTable(name: string) {
  const config = getBigQueryConfig();
  if (!config) {
    return null;
  }
  return `\`${config.projectId}.${platformDataset()}.${name}\``;
}
