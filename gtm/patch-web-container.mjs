#!/usr/bin/env node
/**
 * Patch Goodsnova web GTM export so stitch HTML runs before GA4/DT page_view,
 * first-touch click IDs live in cookies, and every GA4 + Data Tag sends them.
 *
 * Usage:
 *   node gtm/patch-web-container.mjs \
 *     /path/to/GTM-MVWKFXH2_workspace.json \
 *     gtm/import/GTM-MVWKFXH2_stitch-fill.json
 */
import fs from "node:fs";
import path from "node:path";

const src = process.argv[2];
const dest = process.argv[3];
if (!src || !dest) {
  console.error("Usage: node gtm/patch-web-container.mjs <web-export.json> <out.json>");
  process.exit(1);
}

const htmlPath = path.resolve("gtm/web/stitch-gn-first-touch.html");
const stitchHtml = fs.readFileSync(htmlPath, "utf8");
const data = JSON.parse(fs.readFileSync(src, "utf8"));
const cv = data.containerVersion;
const fp = String(Date.now());

const STITCH_NAME = "[Shopify] Stitching -> Order Attributes (gn_uid + first-touch)";
const COOKIE_KEYS = [
  "gn_gclid",
  "gn_gbraid",
  "gn_wbraid",
  "gn_msclkid",
  "gn_fbclid",
  "gn_ttclid",
  "gn_utm_source",
  "gn_utm_medium",
  "gn_utm_campaign",
  "gn_utm_content",
  "gn_utm_term",
  // Current session / click Meta IDs (session cookies). Not first-touch.
  "gn_meta_campaign_id",
  "gn_meta_adset_id",
  "gn_meta_ad_id",
];

function cookieVar(id, cookieName) {
  return {
    accountId: cv.container.accountId || cv.accountId,
    containerId: cv.container.containerId || cv.containerId,
    variableId: String(id),
    name: `cookie ${cookieName}`,
    type: "k",
    parameter: [
      { type: "BOOLEAN", key: "decodeCookie", value: "false" },
      { type: "TEMPLATE", key: "name", value: cookieName },
    ],
    fingerprint: fp,
    formatValue: {},
  };
}

function ga4Param(name, value) {
  return {
    type: "MAP",
    map: [
      { type: "TEMPLATE", key: "parameter", value: name },
      { type: "TEMPLATE", key: "parameterValue", value },
    ],
  };
}

function dtRow(name, value) {
  return {
    type: "MAP",
    map: [
      { type: "TEMPLATE", key: "name", value: name },
      { type: "TEMPLATE", key: "value", value },
      { type: "TEMPLATE", key: "transformation", value: "none" },
      { type: "TEMPLATE", key: "store", value: "none" },
    ],
  };
}

function ensureDtParams(list) {
  const have = new Set(
    (list || []).map((row) => (row.map || []).find((x) => x.key === "name")?.value)
  );
  const extra = [];
  const want = [
    ["gn_uid", "{{cookie gn_uid}}"],
    ...COOKIE_KEYS.map((k) => [k, `{{cookie ${k}}}`]),
  ];
  for (const [name, value] of want) {
    if (!have.has(name)) extra.push(dtRow(name, value));
  }
  return [...(list || []), ...extra];
}

const accountId = cv.tag[0].accountId;
const containerId = cv.tag[0].containerId;

let maxVar = Math.max(...cv.variable.map((v) => Number(v.variableId)));
let maxTrig = Math.max(...cv.trigger.map((t) => Number(t.triggerId)));

const existingCookieNames = new Set(cv.variable.map((v) => v.name));
for (const key of COOKIE_KEYS) {
  const name = `cookie ${key}`;
  if (existingCookieNames.has(name)) continue;
  maxVar += 1;
  cv.variable.push(cookieVar(maxVar, key));
}

const hasInit = cv.trigger.some((t) => t.type === "INIT" || t.name === "init - all pages");
let initTriggerId = cv.trigger.find((t) => t.type === "INIT")?.triggerId;
if (!hasInit) {
  maxTrig += 1;
  initTriggerId = String(maxTrig);
  cv.trigger.push({
    accountId,
    containerId,
    triggerId: initTriggerId,
    name: "init - all pages",
    type: "INIT",
    fingerprint: fp,
  });
}

const stitch = cv.tag.find((t) => t.name === STITCH_NAME);
if (!stitch) throw new Error(`Missing tag ${STITCH_NAME}`);
const htmlParam = (stitch.parameter || []).find((p) => p.key === "html");
if (!htmlParam) throw new Error("Stitch tag has no html parameter");
htmlParam.value = stitchHtml;
const fire = new Set(stitch.firingTriggerId || []);
fire.add(initTriggerId);
fire.add("14"); // keep DOM Ready so cart/update.js retries after Shopify is ready
stitch.firingTriggerId = [...fire];
stitch.priority = { type: "INTEGER", value: "999" };
stitch.fingerprint = fp;

const shared = cv.variable.find((v) => v.name === "ga4 - shared_event_settings");
if (!shared) throw new Error("Missing ga4 - shared_event_settings");
const table = (shared.parameter || []).find((p) => p.key === "eventSettingsTable");
const haveParams = new Set(
  (table.list || []).map((row) => (row.map || []).find((x) => x.key === "parameter")?.value)
);
const ga4Extras = [
  ["gn_uid", "{{cookie gn_uid}}"],
  ...COOKIE_KEYS.map((k) => [k, `{{cookie ${k}}}`]),
  ["user_id", "{{dlv - user_data.customer_id}}"],
];
for (const [name, value] of ga4Extras) {
  if (!haveParams.has(name)) table.list.push(ga4Param(name, value));
}
shared.fingerprint = fp;

const setupTag = [
  {
    tagName: STITCH_NAME,
    stopOnSetupFailure: false,
  },
];

for (const tag of cv.tag) {
  const isGa4 = tag.name.startsWith("[Stape] GA4");
  const isDt = tag.name.startsWith("[Stape] DT");
  if (!isGa4 && !isDt) continue;
  tag.setupTag = setupTag;
  tag.fingerprint = fp;
  if (isDt) {
    const cd = (tag.parameter || []).find((p) => p.key === "custom_data");
    if (cd) cd.list = ensureDtParams(cd.list);
  }
}

data.exportTime = new Date().toISOString().replace("T", " ").slice(0, 19);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(data, null, 4) + "\n");
console.log("Wrote", dest);
console.log("init trigger", initTriggerId, "variables now", cv.variable.length);
