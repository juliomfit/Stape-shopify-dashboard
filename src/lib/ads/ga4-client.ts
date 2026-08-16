import { createSign } from "crypto";
import { getBigQueryConfig } from "@/lib/stape/config";
import { getGa4Config, streamDimensionFilter } from "@/lib/ads/ga4-config";

type TokenResponse = { access_token?: string; error?: string };

export type Ga4ReportRow = {
  dimensions: string[];
  metrics: number[];
};

export async function ga4AccessToken() {
  const config = getBigQueryConfig();
  const creds = config?.credentials as
    | { client_email?: string; private_key?: string }
    | undefined;
  if (!creds?.client_email || !creds.private_key) {
    throw new Error("Service account JSON is missing client_email/private_key.");
  }

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url",
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const jwt = `${unsigned}.${signer.sign(creds.private_key, "base64url")}`;
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: jwt,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as TokenResponse;
  if (!json.access_token) {
    throw new Error(json.error || "Google token exchange failed.");
  }
  return json.access_token;
}

export async function runGa4Report(input: {
  token: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
  limit?: number;
  optional?: boolean;
}): Promise<Ga4ReportRow[]> {
  const ga4 = getGa4Config();
  if (!ga4) {
    throw new Error("GA4_PROPERTY_ID is not set.");
  }
  const body: Record<string, unknown> = {
    dateRanges: [{ startDate: input.startDate, endDate: input.endDate }],
    dimensions: input.dimensions.map((name) => ({ name })),
    metrics: input.metrics.map((name) => ({ name })),
    limit: String(input.limit ?? 50),
  };
  const streamFilter = streamDimensionFilter(ga4.streamId);
  if (streamFilter) {
    body.dimensionFilter = streamFilter;
  }

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${ga4.propertyId}:runReport`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  const payload = (await response.json()) as {
    rows?: {
      dimensionValues?: { value?: string }[];
      metricValues?: { value?: string }[];
    }[];
    error?: { message?: string };
  };
  if (!response.ok) {
    const message = payload.error?.message || `GA4 Data API ${response.status}`;
    if (input.optional) {
      return [];
    }
    throw new Error(message);
  }
  return (payload.rows || []).map((row) => ({
    dimensions: (row.dimensionValues || []).map((item) => item.value || ""),
    metrics: (row.metricValues || []).map((item) => Number(item.value || 0)),
  }));
}
