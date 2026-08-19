import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  applyMetaLandingIdentity,
  campaignGrainKey,
  collapseSessionMetaIds,
  compareAcquisitionRowKeys,
  emptyMetaIdTriple,
  mappingCoverageStatus,
  META_HIERARCHY_CONFLICT,
  parseMetaIdsFromUrl,
  pickAcquisitionRow,
  sanitizeMetaId,
} from "../src/lib/attribution/meta-ids.ts";
import {
  attachMetaIdsToCredits,
  buildMetaFactIndexes,
  evaluateMetaHierarchy,
  exactIdMatch,
  grainAttributedNcac,
  grainOurRoas,
  metaCreditForOrders,
  metaCreditHierarchyHolds,
  META_CHANNEL,
  summarizeMetaMappingAtOrderGrain,
  UNMAPPED_META_LABEL,
  validateMetaCreditHierarchy,
  type MetaCreditOrder,
} from "../src/lib/attribution/meta-credit.ts";
import {
  campaignMappingSummary,
  campaignMappingUiStatus,
  joinMetaAndOurCampaigns,
} from "../src/lib/attribution/campaign-map.ts";
import { parseFirstTouch } from "../src/lib/shopify/first-touch.ts";
import { isInternalNoise } from "../src/lib/attribution/eligibility.ts";

const T0 = Date.UTC(2026, 7, 19, 16, 0, 0);
const PURCHASE = T0 + 2 * 60 * 60 * 1000;

function touch(partial: Partial<MetaCreditOrder["touches"][number]> & { touchpointId: string }): MetaCreditOrder["touches"][number] {
  return {
    ts: T0,
    channel: META_CHANNEL,
    campaign: null,
    campaignId: null,
    adsetId: null,
    adId: null,
    isPaid: true,
    isDirect: false,
    ...partial,
  };
}

function order(touches: MetaCreditOrder["touches"], extra: Partial<MetaCreditOrder> = {}): MetaCreditOrder {
  return {
    transactionId: extra.transactionId ?? "1001",
    purchaseTs: extra.purchaseTs ?? PURCHASE,
    revenue: extra.revenue ?? 100,
    isNewCustomer: extra.isNewCustomer ?? true,
    touches,
  };
}

const indexes = buildMetaFactIndexes({
  campaigns: [
    { campaign_id: "111", campaign_name: "Prospecting" },
    { campaign_id: "222", campaign_name: "Retargeting" },
    { campaign_id: "333", campaign_name: "Same Name" },
    { campaign_id: "444", campaign_name: "Same Name" },
  ],
  adsets: [{ adset_id: "555", campaign_id: "111" }],
  ads: [{ ad_id: "666", adset_id: "555", campaign_id: "111", creative_id: "777" }],
});

test("sanitizeMetaId keeps digits and drops junk", () => {
  assert.equal(sanitizeMetaId(" 1201 "), "1201");
  assert.equal(sanitizeMetaId("abc"), null);
  assert.equal(sanitizeMetaId("(not set)"), null);
  assert.equal(sanitizeMetaId(""), null);
});

test("Meta click with campaign/adset/ad IDs parses from URL", () => {
  const ids = parseMetaIdsFromUrl(
    "https://goodsnova.com/?utm_source=facebook&utm_medium=cpc&gn_meta_campaign_id=111&gn_meta_adset_id=555&gn_meta_ad_id=666&fbclid=abc",
  );
  assert.equal(ids.campaignId, "111");
  assert.equal(ids.adsetId, "555");
  assert.equal(ids.adId, "666");
});

test("Meta click with IDs + UTMs keeps UTMs out of ID fields", () => {
  const ids = parseMetaIdsFromUrl(
    "https://goodsnova.com/?utm_campaign=Prospecting&gn_meta_campaign_id=111",
  );
  assert.equal(ids.campaignId, "111");
  assert.notEqual(ids.campaignId, "Prospecting");
});

test("fbclid without Meta IDs yields empty IDs", () => {
  const ids = parseMetaIdsFromUrl("https://goodsnova.com/?fbclid=IwAR0test");
  assert.equal(ids.campaignId, null);
  assert.equal(ids.adsetId, null);
  assert.equal(ids.adId, null);
});

test("organic visit with no Meta IDs", () => {
  const ids = parseMetaIdsFromUrl("https://goodsnova.com/?utm_source=google&utm_medium=organic");
  assert.equal(ids.campaignId, null);
});

test("direct visit with no Meta IDs", () => {
  const ids = parseMetaIdsFromUrl("https://goodsnova.com/");
  assert.equal(ids.campaignId, null);
  assert.equal(ids.adId, null);
});

test("internal checkout noise is not an eligible Direct touch even with Meta IDs in the URL", () => {
  assert.equal(
    isInternalNoise({
      sessionKey: "s-checkout",
      timestamp: T0,
      pageLocation:
        "https://goodsnova.com/checkouts/cn/abc?gn_meta_campaign_id=111&gn_meta_adset_id=555&gn_meta_ad_id=666",
    }),
    true,
  );
});

test("IDs persist through first-touch vs session storage contract in stitch HTML", () => {
  const html = readFileSync("gtm/web/stitch-gn-first-touch.html", "utf8");
  assert.match(html, /gn_meta_campaign_id/);
  assert.match(html, /gn_meta_adset_id/);
  assert.match(html, /gn_meta_ad_id/);
  assert.match(html, /gn_first_meta_campaign_id/);
  assert.match(html, /gn_first_meta_adset_id/);
  assert.match(html, /gn_first_meta_ad_id/);
  assert.match(html, /sanitizeMetaId/);
  assert.match(html, /attrs\.gn_first_meta_campaign_id/);
  assert.match(html, /setSessionCookie\("gn_meta_campaign_id"/);
  assert.match(html, /gn_session_meta_v1/);
  assert.doesNotMatch(html, /\["gn_meta_campaign_id", ft\./);
  assert.match(html, /if \(!ft && hasAny\)/);
});

test("IDs appear in Shopify cart attributes via parseFirstTouch first-touch names", () => {
  const ft = parseFirstTouch([
    { key: "gn_uid", value: "u1" },
    { key: "gn_first_meta_campaign_id", value: "111" },
    { key: "gn_first_meta_adset_id", value: "555" },
    { key: "gn_first_meta_ad_id", value: "666" },
    { key: "gn_fbclid", value: "abc" },
    { key: "gn_utm_source", value: "facebook" },
  ]);
  assert.equal(ft.metaCampaignId, "111");
  assert.equal(ft.metaAdsetId, "555");
  assert.equal(ft.metaAdId, "666");
  assert.equal(ft.fbclid, "abc");
  assert.equal(ft.utmSource, "facebook");
  assert.equal(ft.uid, "u1");
});

test("legacy gn_meta_* cart keys remain first-touch fallback; gn_first_meta_* wins", () => {
  const legacy = parseFirstTouch([{ key: "gn_meta_campaign_id", value: "111" }]);
  assert.equal(legacy.metaCampaignId, "111");
  const mixed = parseFirstTouch([
    { key: "gn_meta_campaign_id", value: "111" },
    { key: "gn_first_meta_campaign_id", value: "999" },
  ]);
  assert.equal(mixed.metaCampaignId, "999");
});

test("same session repeated event rows collapse to landing IDs", () => {
  const collapsed = collapseSessionMetaIds({
    landing: parseMetaIdsFromUrl("https://goodsnova.com/?gn_meta_campaign_id=111&gn_meta_adset_id=555&gn_meta_ad_id=666"),
    later: [
      parseMetaIdsFromUrl("https://goodsnova.com/products/serum?gn_meta_campaign_id=111&gn_meta_adset_id=555&gn_meta_ad_id=666"),
      parseMetaIdsFromUrl("https://goodsnova.com/cart"),
    ],
  });
  assert.equal(collapsed.campaignId, "111");
  assert.equal(collapsed.adsetId, "555");
  assert.equal(collapsed.adId, "666");
  assert.equal(collapsed.campaignIdConflict, false);
});

test("conflicting IDs keep landing value and set conflict flags", () => {
  const collapsed = collapseSessionMetaIds({
    landing: { campaignId: "111", adsetId: "555", adId: "666", campaignName: null, adsetName: null, adName: null },
    later: [{ campaignId: "999", adsetId: "555", adId: "888", campaignName: null, adsetName: null, adName: null }],
  });
  assert.equal(collapsed.campaignId, "111");
  assert.equal(collapsed.adId, "666");
  assert.equal(collapsed.campaignIdConflict, true);
  assert.equal(collapsed.adIdConflict, true);
  assert.equal(collapsed.adsetIdConflict, false);
});

test("campaignGrainKey prefers ID over UTM name", () => {
  assert.equal(campaignGrainKey({ campaignId: "111", campaign: "Prospecting" }), "111");
  assert.equal(campaignGrainKey({ campaignId: null, campaign: "Prospecting" }), "Prospecting");
  assert.equal(campaignGrainKey({}), "(unmapped)");
});

test("campaign exact-ID match is HIGH and attaches existing credit", () => {
  const credits = attachMetaIdsToCredits({
    order: order([touch({ touchpointId: "t1", campaignId: "111", campaign: "Prospecting" })]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].weight, 1);
  assert.equal(credits[0].creditDollars, 100);
  assert.equal(credits[0].campaignMappingMethod, "campaign_id_exact");
  assert.equal(credits[0].campaignMappingConfidence, "HIGH");
  assert.equal(credits[0].metaCampaignId, "111");
});

test("unique-name legacy fallback is PARTIAL", () => {
  const credits = attachMetaIdsToCredits({
    order: order([touch({ touchpointId: "t1", campaign: "Prospecting" })]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].campaignMappingMethod, "campaign_name_exact_unique");
  assert.equal(credits[0].campaignMappingConfidence, "PARTIAL");
  assert.equal(credits[0].metaCampaignId, "111");
});

test("ambiguous-name rejection does not map", () => {
  const credits = attachMetaIdsToCredits({
    order: order([touch({ touchpointId: "t1", campaign: "Same Name" })]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].campaignMappingMethod, "ambiguous_name");
  assert.equal(credits[0].campaignMappingConfidence, "NONE");
  assert.equal(credits[0].metaCampaignId, null);
});

test("ID present but missing from facts is unmapped, not name fallback", () => {
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({ touchpointId: "t1", campaignId: "000", campaign: "Prospecting" }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].campaignMappingMethod, "unmapped");
  assert.equal(credits[0].metaCampaignId, "000");
});

test("adset and ad exact-ID match; creative comes from ad_id fact", () => {
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "111",
        adsetId: "555",
        adId: "666",
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].adsetMapped, true);
  assert.equal(credits[0].adMapped, true);
  assert.equal(credits[0].metaCreativeId, "777");
  assert.equal(exactIdMatch("555", indexes.adsetIds), true);
});

test("unmapped bucket keeps channel credit", () => {
  const rollup = metaCreditForOrders({
    orders: [order([touch({ touchpointId: "t1", campaign: "Nope" })])],
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(rollup.channelCredit, 100);
  assert.equal(rollup.campaignMappedCredit, 0);
  assert.equal(rollup.campaignUnmappedCredit, 100);
  assert.ok(metaCreditHierarchyHolds(rollup));
});

test("campaign credit <= channel Meta credit; adset <= channel; ad <= channel", () => {
  const rollup = metaCreditForOrders({
    orders: [
      order([
        touch({
          touchpointId: "t1",
          campaignId: "111",
          adsetId: "555",
          adId: "666",
        }),
      ]),
      order(
        [touch({ touchpointId: "t2", campaign: "Nope" })],
        { transactionId: "1002", isNewCustomer: false },
      ),
    ],
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.ok(rollup.campaignMappedCredit <= rollup.channelCredit);
  assert.ok(rollup.adsetMappedCredit <= rollup.channelCredit);
  assert.ok(rollup.adMappedCredit <= rollup.channelCredit);
  assert.equal(
    rollup.campaignMappedCredit + rollup.campaignUnmappedCredit,
    rollup.channelCredit,
  );
  assert.ok(metaCreditHierarchyHolds(rollup));
});

test("new-customer fractional credit is not rounded; returning contributes 0", () => {
  const rollup = metaCreditForOrders({
    orders: [
      order(
        [
          touch({ touchpointId: "a", campaignId: "111", ts: T0 }),
          touch({
            touchpointId: "b",
            channel: "Direct",
            isPaid: false,
            isDirect: true,
            ts: T0 + 1000,
          }),
        ],
        { isNewCustomer: true, revenue: 80 },
      ),
    ],
    model: "linear",
    windowDays: 7,
    indexes,
  });
  const campaign = rollup.byCampaign.find((row) => row.key === "111");
  assert.ok(campaign);
  assert.equal(campaign.newCustomerCredit, 0.5);
  assert.equal(campaign.newCustomerRevenue, 40);
});

test("attributed nCAC uses spend / new-customer credit; no-spend is null", () => {
  assert.equal(grainAttributedNcac(100, 2), 50);
  assert.equal(grainAttributedNcac(0, 2), null);
  assert.equal(grainOurRoas(200, 0), null);
  assert.equal(grainOurRoas(200, 100), 2);
});

test("joinMetaAndOurCampaigns still ID-first; coverage stays NOT YET VALIDATED without HIGH-ID", () => {
  const rows = joinMetaAndOurCampaigns(
    [
      {
        campaign_id: "111",
        campaign_name: "Prospecting",
        spend: 100,
        impressions: 10,
        clicks: 2,
        purchases: 3,
        purchase_value: 150,
      },
    ],
    [{ campaign: "Nope", channel: META_CHANNEL, orders: 1, revenue: 80 }],
  );
  const summary = campaignMappingSummary(rows);
  assert.equal(summary.exactId, 0);
  assert.equal(campaignMappingUiStatus(summary), "NOT_YET_VALIDATED");
});

test("mapping coverage shows HAS_HIGH_ID_MAPS only after an ID map exists", () => {
  assert.equal(
    mappingCoverageStatus({
      highIdMappedTouches: 0,
      nameFallbackTouches: 0,
      unmappedTouches: 80,
    }),
    "NOT_YET_VALIDATED",
  );
  assert.equal(
    mappingCoverageStatus({
      highIdMappedTouches: 1,
      nameFallbackTouches: 0,
      unmappedTouches: 79,
    }),
    "HAS_HIGH_ID_MAPS",
  );
});

test("organic and Direct orders do not create Meta child credit", () => {
  const rollup = metaCreditForOrders({
    orders: [
      order(
        [
          touch({
            touchpointId: "d1",
            channel: "Direct",
            isPaid: false,
            isDirect: true,
          }),
        ],
        { transactionId: "direct" },
      ),
    ],
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(rollup.channelCredit, 0);
  assert.equal(rollup.credits.length, 0);
});

test("unmapped Meta label is retained for reporting", () => {
  assert.equal(UNMAPPED_META_LABEL, "Unmapped Meta");
});

test("Campaign A then Campaign B: first-touch stays A, session and typed event become B", () => {
  const campaignA = { campaignId: "111", adsetId: "555", adId: "666" };
  const campaignB = { campaignId: "222", adsetId: "888", adId: "999" };
  const first = applyMetaLandingIdentity({
    urlIds: campaignA,
    firstTouch: emptyMetaIdTriple(),
    sessionIds: emptyMetaIdTriple(),
  });
  assert.equal(first.firstTouch.campaignId, "111");
  assert.equal(first.sessionIds.campaignId, "111");
  assert.equal(first.typedEventIds.campaignId, "111");

  const later = applyMetaLandingIdentity({
    urlIds: campaignB,
    firstTouch: first.firstTouch,
    sessionIds: first.sessionIds,
  });
  assert.equal(later.firstTouch.campaignId, "111");
  assert.equal(later.firstTouch.adsetId, "555");
  assert.equal(later.firstTouch.adId, "666");
  assert.equal(later.sessionIds.campaignId, "222");
  assert.equal(later.sessionIds.adsetId, "888");
  assert.equal(later.sessionIds.adId, "999");
  assert.equal(later.typedEventIds.campaignId, "222");
  assert.equal(later.typedEventIds.adId, "999");

  const canonicalB = parseMetaIdsFromUrl(
    "https://goodsnova.com/?gn_meta_campaign_id=222&gn_meta_adset_id=888&gn_meta_ad_id=999",
  );
  assert.equal(canonicalB.campaignId, "222");
  assert.equal(canonicalB.adsetId, "888");
  assert.equal(canonicalB.adId, "999");

  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t-b",
        campaignId: canonicalB.campaignId,
        adsetId: canonicalB.adsetId,
        adId: canonicalB.adId,
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].metaCampaignId, "222");
  assert.notEqual(credits[0].metaCampaignId, later.firstTouch.campaignId);
});

test("same timestamp acquisition row is deterministic via event_id", () => {
  const rows = [
    { eventTimestamp: T0, eventId: "evt-b", campaignId: "222" },
    { eventTimestamp: T0, eventId: "evt-a", campaignId: "111" },
    { eventTimestamp: T0 + 1, eventId: "evt-c", campaignId: "333" },
  ];
  assert.equal(compareAcquisitionRowKeys(rows[0], rows[1]) > 0, true);
  const picked = pickAcquisitionRow(rows);
  assert.equal(picked?.eventId, "evt-a");
  assert.equal(picked?.campaignId, "111");
  assert.deepEqual(pickAcquisitionRow(rows), pickAcquisitionRow([...rows].reverse()));
});

test("canonical order mapping rate is <= 100% and stays in [0, 1]", () => {
  const rates = summarizeMetaMappingAtOrderGrain({
    orders: [
      order([
        touch({
          touchpointId: "t1",
          campaignId: "111",
          adsetId: "555",
          adId: "666",
        }),
      ]),
      order(
        [touch({ touchpointId: "t2", campaign: "Nope" })],
        { transactionId: "1002", isNewCustomer: false },
      ),
    ],
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(rates.metaAttributedOrders, 2);
  assert.equal(rates.campaignMappedOrders, 1);
  assert.equal(rates.campaignUnmappedOrders, 1);
  assert.equal(rates.campaignMappedOrders + rates.campaignUnmappedOrders, rates.metaAttributedOrders);
  assert.ok(rates.campaignMappingRate <= 1);
  assert.ok(rates.adsetMappingRate <= 1);
  assert.ok(rates.adMappingRate <= 1);
  assert.equal(rates.campaignMappingRate, 0.5);
  assert.equal(
    rates.campaignMappedCredit + rates.campaignUnmappedCredit,
    rates.metaChannelCredit,
  );
});

test("campaign/adset/ad hierarchy relationship maps when parents agree", () => {
  assert.deepEqual(indexes.adsetParentCampaign.get("555"), "111");
  assert.deepEqual(indexes.adParentAdset.get("666"), "555");
  assert.deepEqual(indexes.adParentCampaign.get("666"), "111");
  const check = evaluateMetaHierarchy(
    { campaignId: "111", adsetId: "555", adId: "666" },
    indexes,
  );
  assert.equal(check.conflict, false);
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "111",
        adsetId: "555",
        adId: "666",
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].campaignMappingMethod, "campaign_id_exact");
  assert.equal(credits[0].adsetMapped, true);
  assert.equal(credits[0].adMapped, true);
  assert.equal(credits[0].hierarchyConflict, false);
});

test("conflicting campaign/adset pair is META_HIERARCHY_CONFLICT and not fully mapped", () => {
  const check = evaluateMetaHierarchy(
    { campaignId: "222", adsetId: "555", adId: null },
    indexes,
  );
  assert.equal(check.conflict, true);
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "222",
        adsetId: "555",
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  assert.equal(credits[0].hierarchyConflict, true);
  assert.equal(credits[0].campaignMappingMethod, "unmapped");
  assert.equal(credits[0].adsetMapped, false);
  assert.equal(META_HIERARCHY_CONFLICT, "META_HIERARCHY_CONFLICT");
});

test("conflicting adset/ad pair is META_HIERARCHY_CONFLICT and not fully mapped", () => {
  const check = evaluateMetaHierarchy(
    { campaignId: "111", adsetId: "555", adId: "666" },
    buildMetaFactIndexes({
      campaigns: [{ campaign_id: "111", campaign_name: "Prospecting" }],
      adsets: [{ adset_id: "555", campaign_id: "111" }],
      ads: [{ ad_id: "666", adset_id: "999", campaign_id: "111" }],
    }),
  );
  assert.equal(check.conflict, true);
  const credits = attachMetaIdsToCredits({
    order: order([
      touch({
        touchpointId: "t1",
        campaignId: "111",
        adsetId: "555",
        adId: "666",
      }),
    ]),
    model: "last_non_direct",
    windowDays: 7,
    indexes: buildMetaFactIndexes({
      campaigns: [{ campaign_id: "111", campaign_name: "Prospecting" }],
      adsets: [{ adset_id: "555", campaign_id: "111" }],
      ads: [{ ad_id: "666", adset_id: "999", campaign_id: "111" }],
    }),
  });
  assert.equal(credits[0].hierarchyConflict, true);
  assert.equal(credits[0].adMapped, false);
  assert.equal(credits[0].adsetMapped, false);
});

test("actual Meta child-credit hierarchy has 0 violations when parents agree", () => {
  const rollup = metaCreditForOrders({
    orders: [
      order([
        touch({
          touchpointId: "t1",
          campaignId: "111",
          adsetId: "555",
          adId: "666",
        }),
      ]),
    ],
    model: "last_non_direct",
    windowDays: 7,
    indexes,
  });
  const result = validateMetaCreditHierarchy(rollup, indexes);
  assert.equal(result.metaChannelCredit, 100);
  assert.equal(result.campaignMappedCredit, 100);
  assert.equal(result.campaignUnmappedCredit, 0);
  assert.equal(result.adsetMappedCredit, 100);
  assert.equal(result.adMappedCredit, 100);
  assert.equal(result.hierarchyViolations, 0);
  assert.ok(metaCreditHierarchyHolds(rollup));
});
