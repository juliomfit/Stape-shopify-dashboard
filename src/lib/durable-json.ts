import { cookies } from "next/headers";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const COOKIE_PREFIX = "gn_store_";
const MAX_COOKIE_BYTES = 3500;

function cookieName(key: string) {
  return `${COOKIE_PREFIX}${key}`;
}

function filePath(key: string) {
  return path.join(process.cwd(), "secrets", `${key}.json`);
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readDurableJson<T>(key: string): Promise<T | null> {
  try {
    const jar = await cookies();
    const fromCookie = jar.get(cookieName(key))?.value;
    if (fromCookie) {
      return parseJson<T>(fromCookie);
    }
  } catch {
    // cookies() can throw outside a request; fall through to disk/env.
  }

  if (key === "ads-paste") {
    const fromEnv = process.env.ADS_PASTE_JSON?.trim();
    if (fromEnv) {
      return parseJson<T>(fromEnv);
    }
  }

  try {
    return parseJson<T>(await readFile(filePath(key), "utf8"));
  } catch {
    return null;
  }
}

export async function writeDurableJson(key: string, value: unknown) {
  const serialized = `${JSON.stringify(value)}\n`;
  const onVercel = Boolean(process.env.VERCEL);

  if (onVercel) {
    if (Buffer.byteLength(serialized, "utf8") > MAX_COOKIE_BYTES) {
      throw new Error(
        "Spend/credentials payload is too large for Vercel cookie storage. Use fewer campaign rows or ADS_PASTE_JSON in Vercel env.",
      );
    }

    const jar = await cookies();
    jar.set(cookieName(key), serialized.trim(), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 400,
    });
    return;
  }

  await mkdir(path.dirname(filePath(key)), { recursive: true });
  await writeFile(filePath(key), serialized, { encoding: "utf8", mode: 0o600 });
}

export async function clearDurableJson(key: string) {
  try {
    const jar = await cookies();
    jar.delete(cookieName(key));
  } catch {
    // ignore
  }

  try {
    await unlink(filePath(key));
  } catch {
    // Already gone.
  }
}
