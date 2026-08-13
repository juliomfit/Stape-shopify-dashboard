export const GATE_COOKIE = "gn_dashboard_gate";

export function dashboardPassword() {
  return process.env.DASHBOARD_PASSWORD?.trim() || "";
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function gateToken(password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("goodsnova-dashboard-gate"),
  );
  return toHex(signature);
}

export async function gateCookieMatches(
  cookie: string | undefined,
  password: string,
) {
  if (!cookie || !password) {
    return false;
  }

  return safeEqual(cookie, await gateToken(password));
}
