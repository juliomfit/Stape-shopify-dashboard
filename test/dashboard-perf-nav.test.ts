import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("sidebar and bottom nav disable automatic viewport prefetch", () => {
  const navLink = readFileSync("src/components/layout/NavPrefetchLink.tsx", "utf8");
  const sidebar = readFileSync("src/components/layout/NavLinks.tsx", "utf8");
  const bottom = readFileSync("src/components/layout/BottomNav.tsx", "utf8");
  assert.match(navLink, /prefetch=\{false\}/);
  assert.doesNotMatch(navLink, /router\.prefetch/);
  assert.doesNotMatch(navLink, /useRouter/);
  assert.match(sidebar, /prefetch=\{false\}/);
  assert.doesNotMatch(sidebar, /NavPrefetchLink/);
  assert.doesNotMatch(sidebar, /router\.prefetch/);
  assert.match(bottom, /prefetch=\{false\}/);
});

test("auth gate moved from middleware.ts to proxy.ts", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  assert.match(proxy, /export async function proxy/);
  assert.match(proxy, /DASHBOARD_PASSWORD|dashboardPassword/);
  assert.match(proxy, /GATE_COOKIE/);
});
