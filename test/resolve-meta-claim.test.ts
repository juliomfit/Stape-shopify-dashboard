import assert from "node:assert/strict";
import test from "node:test";
import { resolveMetaClaim } from "../src/lib/ads/resolve-meta-claim.ts";

const paste = {
  source: "facebook" as const,
  label: "Meta Ads",
  state: "connected" as const,
  claimKind: "paste" as const,
  spend: 999,
  purchases: 9,
  revenue: 9000,
  message: "paste",
};

test("warehouse rows win over paste", () => {
  const claim = resolveMetaClaim({
    warehouse: { spend: 120, purchases: 3, purchaseValue: 400 },
    lastSuccessfulSync: true,
    periodDayCount: 7,
    periodLabel: "7d",
    paste,
    flyweelConfigured: true,
    graph: null,
  });
  assert.equal(claim.claimKind, "warehouse");
  assert.equal(claim.spend, 120);
});

test("single-day empty warehouse after sync is known $0 not null", () => {
  const claim = resolveMetaClaim({
    warehouse: null,
    lastSuccessfulSync: true,
    periodDayCount: 1,
    periodLabel: "Today",
    paste,
    flyweelConfigured: true,
    graph: null,
  });
  assert.equal(claim.spend, 0);
  assert.equal(claim.claimKind, "warehouse");
});

test("missing warehouse without sync stays null even if Flyweel is configured", () => {
  const claim = resolveMetaClaim({
    warehouse: null,
    lastSuccessfulSync: false,
    periodDayCount: 7,
    periodLabel: "7d",
    paste: null,
    flyweelConfigured: true,
    graph: {
      source: "facebook",
      label: "Meta Ads",
      state: "connected",
      spend: 50,
      purchases: 1,
      revenue: 80,
    },
  });
  assert.equal(claim.spend, null);
  assert.equal(claim.claimKind, "missing");
});

test("Flyweel warehouse mode ignores Meta paste so Overview matches /meta", () => {
  const claim = resolveMetaClaim({
    warehouse: null,
    lastSuccessfulSync: false,
    periodDayCount: 7,
    periodLabel: "7d",
    paste,
    flyweelConfigured: true,
    graph: null,
  });
  assert.equal(claim.spend, null);
  assert.equal(claim.claimKind, "missing");
});

test("paste fills only when warehouse is empty and Flyweel is not the provider", () => {
  const claim = resolveMetaClaim({
    warehouse: null,
    lastSuccessfulSync: false,
    periodDayCount: 7,
    periodLabel: "7d",
    paste,
    flyweelConfigured: false,
    graph: null,
  });
  assert.equal(claim.spend, 999);
  assert.equal(claim.claimKind, "paste");
});
