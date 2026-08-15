import { metaApiVersion } from "@/lib/platform/config";

export class MetaApiError extends Error {
  status: number;
  retryAfterMs: number | null;

  constructor(message: string, status: number, retryAfterMs: number | null) {
    super(message);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(response: Response, payload: { error?: { code?: number } }) {
  const header = response.headers.get("retry-after");
  if (header && /^\d+$/.test(header)) {
    return Number(header) * 1000;
  }
  if (response.status === 429 || payload.error?.code === 17 || payload.error?.code === 613) {
    return 8000;
  }
  return null;
}

export async function graphGet<T>(
  path: string,
  accessToken: string,
  search: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`https://graph.facebook.com/${metaApiVersion()}${path}`);
  for (const [key, value] of Object.entries(search)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("access_token", accessToken);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { cache: "no-store" });
    const payload = (await response.json()) as T & {
      error?: { message?: string; code?: number };
    };
    const wait = retryAfterMs(response, payload);
    if (wait != null && attempt < 3) {
      await sleep(wait * (attempt + 1));
      continue;
    }
    if (!response.ok || payload.error) {
      lastError = new MetaApiError(
        payload.error?.message || `Meta API failed (${response.status})`,
        response.status,
        wait,
      );
      if (response.status >= 500 && attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw lastError;
    }
    return payload;
  }
  throw lastError || new Error("Meta API failed");
}

export async function graphPaginate<T>(
  path: string,
  accessToken: string,
  search: Record<string, string>,
  maxPages = 40,
): Promise<T[]> {
  const rows: T[] = [];
  let nextPath = path;
  let nextSearch: Record<string, string> | null = search;
  for (let page = 0; page < maxPages; page += 1) {
    const payload = (await graphGet<Record<string, unknown>>(
      nextPath,
      accessToken,
      nextSearch || {},
    )) as { data?: T[]; paging?: { next?: string } };
    rows.push(...(payload.data || []));
    const nextUrl = payload.paging?.next;
    if (!nextUrl) {
      break;
    }
    const parsed = new URL(nextUrl);
    nextPath = parsed.pathname.replace(/^\/v[\d.]+/, "") || path;
    nextSearch = Object.fromEntries(parsed.searchParams.entries());
    delete nextSearch.access_token;
  }
  return rows;
}
