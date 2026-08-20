import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  attachMetaIdsToCredits,
  buildMetaFactIndexes,
  META_CHANNEL,
  metaCreditForOrders,
  type MetaCreditOrder,
} from "../src/lib/attribution/meta-credit.ts";
import {
  dailyObservedByEntity,
  dailyObservedMetaRevenue,
  observedHierarchyHolds,
  rollupObservedMetaChildren,
} from "../src/lib/attribution/observed-meta-grain.ts";
import { pacificYmd } from "../src/lib/period.ts";
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

function organic(touchpointId: string): MetaCreditOrder["touches"][number] {
  return {
    touchpointId,
    ts: T0,
    channel: "Organic Search",
    campaign: null,
    campaignId: null,
    adsetId: null,
    adId: null,
    isPaid: false,
    isDirect: false,
  };
}

test("utm_content becomes the ad display name without changing credit weight", () => {
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        adsetId: "120001",
        adId: "130001",
        content: "UGC+Hook+3+-+Woman+Wall",
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes: emptyFlyweelIndexes,
  });
  assert.equal(credits[0]?.weight, 1);
  assert.equal(credits[0]?.observedAdId, "130001");
  assert.equal(credits[0]?.observedAdName, "UGC Hook 3 - Woman Wall");
  const hierarchy = rollupObservedMetaChildren(credits);
  assert.equal(hierarchy.ads[0]?.adLabel, "UGC Hook 3 - Woman Wall");
  assert.equal(hierarchy.ads[0]?.attributedRevenue, 100);
});

test("daily attributed orders are sum of credit.weight, uniqueOrders stay separate", () => {
  const credits = [
    ...attachMetaIdsToCredits({
      order: order(
        [
          touch({ touchpointId: "t-a", adsetId: "120001", adId: "130001" }),
          organic("t-a-org"),
        ],
        { transactionId: "1001" },
      ),
      model: "linear",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
    ...attachMetaIdsToCredits({
      order: order(
        [
          touch({ touchpointId: "t-b", adsetId: "120001", adId: "130001" }),
          organic("t-b-org"),
        ],
        { transactionId: "1002" },
      ),
      model: "linear",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
  ].filter((credit) => credit.channel === META_CHANNEL);
  assert.equal(credits.length, 2);
  assert.equal(credits[0]?.weight, 0.5);
  assert.equal(credits[1]?.weight, 0.5);
  const day = pacificYmd(PURCHASE);
  const points = dailyObservedMetaRevenue(credits, [day], "adset", "120001");
  assert.equal(points.length, 1);
  assert.equal(points[0]?.attributedOrders, 1);
  assert.equal(points[0]?.uniqueOrders, 2);
  assert.notEqual(points[0]?.attributedOrders, points[0]?.uniqueOrders);
});

test("adset daily series filters by observedAdsetId", () => {
  const credits = [
    ...attachMetaIdsToCredits({
      order: order([touch({ touchpointId: "t1", adsetId: "120001", adId: "130001" })], {
        revenue: 80,
      }),
      model: "last_non_direct",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
    ...attachMetaIdsToCredits({
      order: order(
        [touch({ touchpointId: "t2", adsetId: "120002", adId: "130002" })],
        { transactionId: "1002", revenue: 20 },
      ),
      model: "last_non_direct",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
  ];
  const day = pacificYmd(PURCHASE);
  const onlyA = dailyObservedMetaRevenue(credits, [day], "adset", "120001");
  const onlyB = dailyObservedMetaRevenue(credits, [day], "adset", "120002");
  assert.equal(onlyA[0]?.revenue, 80);
  assert.equal(onlyB[0]?.revenue, 20);
  assert.equal(onlyA[0]?.attributedOrders, 1);
  assert.equal(onlyB[0]?.attributedOrders, 1);
});

test("ad daily series filters by observedAdId", () => {
  const credits = [
    ...attachMetaIdsToCredits({
      order: order([touch({ touchpointId: "t1", adsetId: "120001", adId: "130001" })], {
        revenue: 70,
      }),
      model: "last_non_direct",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
    ...attachMetaIdsToCredits({
      order: order(
        [touch({ touchpointId: "t2", adsetId: "120001", adId: "130002" })],
        { transactionId: "1002", revenue: 30 },
      ),
      model: "last_non_direct",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
  ];
  const day = pacificYmd(PURCHASE);
  const adA = dailyObservedMetaRevenue(credits, [day], "ad", "130001");
  const adB = dailyObservedMetaRevenue(credits, [day], "ad", "130002");
  assert.equal(adA[0]?.revenue, 70);
  assert.equal(adB[0]?.revenue, 30);
});

test("campaign/adset/ad selectors receive different entity series", () => {
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
  const day = pacificYmd(PURCHASE);
  const campaigns = dailyObservedByEntity(credits, [day], "campaign");
  const adsets = dailyObservedByEntity(credits, [day], "adset");
  const ads = dailyObservedByEntity(credits, [day], "ad");
  assert.ok(campaigns.length >= 1);
  assert.deepEqual(adsets.map((row) => row.key), ["120001"]);
  assert.deepEqual(ads.map((row) => row.key), ["130001"]);
  assert.notEqual(campaigns[0]?.key, ads[0]?.key);
  assert.notDeepEqual(
    campaigns.map((row) => row.key),
    adsets.map((row) => row.key),
  );
});

test("daily revenue buckets reconcile to the corresponding rollup", () => {
  const credits = [
    ...attachMetaIdsToCredits({
      order: order([touch({ touchpointId: "t1", adsetId: "120001", adId: "130001" })], {
        revenue: 80,
      }),
      model: "last_non_direct",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
    ...attachMetaIdsToCredits({
      order: order(
        [touch({ touchpointId: "t2", adsetId: "120002", adId: "130002" })],
        { transactionId: "1002", revenue: 20, purchaseTs: PURCHASE + 24 * 60 * 60 * 1000 },
      ),
      model: "last_non_direct",
      windowDays: 7,
      indexes: emptyFlyweelIndexes,
    }),
  ];
  const dayA = pacificYmd(PURCHASE);
  const dayB = pacificYmd(PURCHASE + 24 * 60 * 60 * 1000);
  const days = [dayA, dayB];
  const hierarchy = rollupObservedMetaChildren(credits);
  const allDays = dailyObservedMetaRevenue(credits, days, "campaign");
  assert.equal(
    allDays.reduce((sum, point) => sum + point.revenue, 0),
    hierarchy.parentRevenue,
  );
  const adsetA = dailyObservedMetaRevenue(credits, days, "adset", "120001");
  assert.equal(
    adsetA.reduce((sum, point) => sum + point.revenue, 0),
    hierarchy.adsets.find((row) => row.adsetId === "120001")?.attributedRevenue,
  );
  const adB = dailyObservedMetaRevenue(credits, days, "ad", "130002");
  assert.equal(
    adB.reduce((sum, point) => sum + point.revenue, 0),
    hierarchy.ads.find((row) => row.adId === "130002")?.attributedRevenue,
  );
  const byAdset = dailyObservedByEntity(credits, days, "adset");
  assert.equal(byAdset[0]?.key, "120001");
  assert.equal(byAdset[0]?.revenue, 80);
});

test("Meta analytics chart plots one metric and grain-specific Flyweel copy", () => {
  const src = readFileSync("src/components/dashboard/MetaAnalyticsChart.tsx", "utf8");
  assert.match(src, /campaignSeries/);
  assert.match(src, /adsetSeries/);
  assert.match(src, /adSeries/);
  assert.match(src, /FLYWEEL_ADSET_SPEND_UNAVAILABLE/);
  assert.match(src, /FLYWEEL_AD_SPEND_UNAVAILABLE/);
  assert.match(src, /option value="attributedOrders"/);
  assert.doesNotMatch(src, /seriesB=\{\{\s*label: "Attributed orders"/);
});

test("performance workspace grain switcher and child metrics hide platform spend", () => {
  const src = readFileSync("src/components/dashboard/MetaPerformanceWorkspace.tsx", "utf8");
  assert.match(src, /Campaigns/);
  assert.match(src, /Ad Sets/);
  assert.match(src, /Ads/);
  assert.match(src, /FLYWEEL_AD_SPEND_UNAVAILABLE/);
  assert.match(src, /prefetch=\{false\}/);
  assert.doesNotMatch(src, /router\.prefetch/);
  assert.doesNotMatch(src, /Matched campaigns/);
});
