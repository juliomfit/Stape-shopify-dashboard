import assert from "node:assert/strict";
import test from "node:test";
import {
  attachMetaIdsToCredits,
  buildMetaFactIndexes,
  META_CHANNEL,
  metaCreditForOrders,
  type MetaCreditOrder,
} from "../src/lib/attribution/meta-credit.ts";
import {
  observedHierarchyHolds,
  rollupObservedMetaChildren,
} from "../src/lib/attribution/observed-meta-grain.ts";
import { SESSION_ID_CONFLICT } from "../src/lib/attribution/meta-ids.ts";

const T0 = Date.UTC(2026, 7, 19, 16, 0, 0);
const PURCHASE = T0 + 2 * 60 * 60 * 1000;

function touch(
  partial: Partial<MetaCreditOrder["touches"][number]> & { touchpointId: string },
): MetaCreditOrder["touches"][number] {
  return {
    ts: T0,
    channel: META_CHANNEL,
    campaign: "USA+CBO+%7C+APRIL+17",
    campaignId: null,
    adsetId: null,
    adId: null,
    isPaid: true,
    isDirect: false,
    ...partial,
  };
}

function order(
  touches: MetaCreditOrder["touches"],
  extra: Partial<MetaCreditOrder> = {},
): MetaCreditOrder {
  return {
    transactionId: extra.transactionId ?? "1001",
    purchaseTs: extra.purchaseTs ?? PURCHASE,
    revenue: extra.revenue ?? 100,
    isNewCustomer: extra.isNewCustomer ?? true,
    touches,
  };
}

const emptyFlyweelIndexes = buildMetaFactIndexes({
  campaigns: [
    {
      campaign_id: "69ce2b5e-0000-4000-8000-00000000c90a",
      campaign_name: "USA CBO | APRIL 17",
    },
  ],
  adsets: [],
  ads: [],
});

test("observed adset/ad IDs appear with empty Flyweel child indexes and are not platform-verified", () => {
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "120001",
        adsetId: "120001",
        adId: "130001",
        campaign: "USA+CBO+%7C+APRIL+17",
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes: emptyFlyweelIndexes,
  });
  assert.equal(credits[0]?.observedAdsetId, "120001");
  assert.equal(credits[0]?.observedAdId, "130001");
  assert.equal(credits[0]?.adsetMapped, false);
  assert.equal(credits[0]?.adMapped, false);
  assert.equal(credits[0]?.platformVerifiedAdset, false);
  assert.equal(credits[0]?.platformVerifiedAd, false);
  assert.equal(credits[0]?.campaignMappingMethod, "campaign_name_exact_unique");
  assert.equal(credits[0]?.campaignMappingConfidence, "PARTIAL");
  const hierarchy = rollupObservedMetaChildren(credits);
  assert.equal(hierarchy.adsets.length, 1);
  assert.equal(hierarchy.adsets[0]?.adsetId, "120001");
  assert.equal(hierarchy.ads.length, 1);
  assert.equal(hierarchy.ads[0]?.adId, "130001");
  assert.equal(hierarchy.adsets[0]?.platformVerified, false);
  assert.equal(hierarchy.ads[0]?.platformVerified, false);
  assert.equal(hierarchy.adsets[0]?.attributedRevenue, 100);
  assert.ok(observedHierarchyHolds(hierarchy));
});

test("session ID conflict is excluded from observed child rollup and kept in conflict bucket", () => {
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "120001",
        adsetId: "120001",
        adId: "130001",
        adsetIdConflict: true,
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes: emptyFlyweelIndexes,
  });
  assert.equal(credits[0]?.sessionIdConflict, true);
  assert.equal(credits[0]?.observedAdsetId, null);
  assert.equal(credits[0]?.observedAdId, null);
  assert.equal(credits[0]?.unmappedReason, SESSION_ID_CONFLICT);
  assert.equal(credits[0]?.creditDollars, 100);
  const hierarchy = rollupObservedMetaChildren(credits);
  assert.equal(hierarchy.adsets.length, 0);
  assert.equal(hierarchy.ads.length, 0);
  assert.equal(hierarchy.conflict.attributedRevenue, 100);
  assert.equal(hierarchy.parentRevenue, 100);
  assert.ok(observedHierarchyHolds(hierarchy));
});

test("missing adId keeps adset credit and puts ad credit in unidentified-ad bucket", () => {
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "120001",
        adsetId: "120001",
        adId: null,
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes: emptyFlyweelIndexes,
  });
  const hierarchy = rollupObservedMetaChildren(credits);
  assert.equal(hierarchy.adsets.length, 1);
  assert.equal(hierarchy.adsets[0]?.attributedRevenue, 100);
  assert.equal(hierarchy.ads.length, 0);
  assert.equal(hierarchy.unidentifiedAd.attributedRevenue, 100);
  assert.equal(hierarchy.unidentifiedAdset.attributedRevenue, 0);
  assert.ok(observedHierarchyHolds(hierarchy));
});

test("observed child totals reconcile to parent Meta credit", () => {
  const rollup = metaCreditForOrders({
    orders: [
      order([
        touch({
          touchpointId: "t1",
          adsetId: "120001",
          adId: "130001",
        }),
      ]),
      order(
        [
          touch({
            touchpointId: "t2",
            adsetId: "120002",
            adId: null,
            campaign: "USA CBO | APRIL 17",
          }),
        ],
        { transactionId: "1002", revenue: 50 },
      ),
      order(
        [
          touch({
            touchpointId: "t3",
            adsetId: null,
            adId: null,
            campaign: "USA CBO | APRIL 17",
          }),
        ],
        { transactionId: "1003", revenue: 25, isNewCustomer: false },
      ),
    ],
    model: "last_non_direct",
    windowDays: 7,
    indexes: emptyFlyweelIndexes,
  });
  const hierarchy = rollupObservedMetaChildren(rollup.credits);
  assert.equal(hierarchy.parentRevenue, 175);
  const observedAdset = hierarchy.adsets.reduce((sum, row) => sum + row.attributedRevenue, 0);
  assert.equal(
    observedAdset + hierarchy.unidentifiedAdset.attributedRevenue + hierarchy.conflict.attributedRevenue,
    175,
  );
  const observedAd = hierarchy.ads.reduce((sum, row) => sum + row.attributedRevenue, 0);
  assert.equal(
    observedAd + hierarchy.unidentifiedAd.attributedRevenue + hierarchy.conflict.attributedRevenue,
    175,
  );
  assert.ok(hierarchy.adsets.every((row) => row.attributedRevenue <= hierarchy.parentRevenue));
  assert.ok(observedHierarchyHolds(hierarchy));
});

test("Flyweel UUID does not HIGH-match a native observed campaign ID", () => {
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "1202149000",
        campaign: "Other Campaign",
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes: emptyFlyweelIndexes,
  });
  assert.notEqual(credits[0]?.campaignMappingMethod, "campaign_id_exact");
  assert.notEqual(credits[0]?.campaignMappingConfidence, "HIGH");
  assert.equal(credits[0]?.observedCampaignId, "1202149000");
});
