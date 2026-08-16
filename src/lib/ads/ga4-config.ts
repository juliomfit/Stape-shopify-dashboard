export type Ga4Config = {
  propertyId: string;
  streamId: string;
  measurementId: string;
};

export function getGa4Config(): Ga4Config | null {
  const propertyId = (process.env.GA4_PROPERTY_ID || "")
    .trim()
    .replace(/^properties\//i, "");
  if (!propertyId) {
    return null;
  }
  return {
    propertyId,
    streamId: (process.env.GA4_STREAM_ID || "").trim(),
    measurementId: (process.env.GA4_MEASUREMENT_ID || "").trim(),
  };
}

export function streamDimensionFilter(streamId: string) {
  if (!streamId) {
    return undefined;
  }
  return {
    filter: {
      fieldName: "streamId",
      stringFilter: { matchType: "EXACT" as const, value: streamId },
    },
  };
}

export function formatGa4Date(value: string) {
  const raw = value.trim();
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return raw.slice(0, 10);
}

export function friendlyGa4Error(message: string) {
  if (/analyticsdata\.googleapis\.com/i.test(message) && /not been used|disabled/i.test(message)) {
    return `Enable Google Analytics Data API on the GCP project that owns the service account JSON (the URL in this error). Wait 2 minutes, then Refresh GA4. ${message}`;
  }
  if (/PERMISSION_DENIED|does not have sufficient permissions/i.test(message)) {
    return `GA4 Analyst binding missing or wrong property. Property access is ${process.env.GA4_PROPERTY_ID || "unset"}. ${message}`;
  }
  return message;
}
