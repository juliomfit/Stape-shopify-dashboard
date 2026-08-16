import assert from "node:assert/strict";
import test from "node:test";
import {
  isEmailTraffic,
  observedSource,
} from "../src/lib/tracking/observed-source.ts";

const empty = {
  uid: "u1",
  ts: "1",
  landingPath: "/",
  referrer: "",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  utmContent: "",
  utmTerm: "",
  gclid: "",
  gbraid: "",
  wbraid: "",
  fbclid: "",
  msclkid: "",
  ttclid: "",
};

test("sendvio and any email utm_source populate from the visit, not an allowlist", () => {
  assert.equal(
    observedSource({ ...empty, utmSource: "sendvio", utmMedium: "email" }),
    "sendvio",
  );
  assert.equal(isEmailTraffic("sendvio", ""), true);
  assert.equal(isEmailTraffic("sendvio", "email"), true);
  assert.equal(
    observedSource({ ...empty, utmSource: "BrandNewESP", utmMedium: "email" }),
    "brandnewesp",
  );
  assert.equal(isEmailTraffic("BrandNewESP", "email"), true);
  assert.equal(observedSource({ ...empty, utmSource: "sendvio" }), "sendvio");
  assert.notEqual(observedSource({ ...empty, utmSource: "sendvio" }), "Direct");
});

test("unknown utm_source still becomes its own source row", () => {
  assert.equal(observedSource({ ...empty, utmSource: "affiliate-x" }), "affiliate-x");
  assert.equal(isEmailTraffic("affiliate-x", ""), false);
});
