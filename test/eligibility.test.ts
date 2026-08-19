import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyEligibleChannel,
  collapseEventsToSessionTouches,
  isInternalNoise,
  isRealDirect,
  isTouchEligible,
  type EligibilityEvent,
} from "../src/lib/attribution/eligibility.ts";

const T0 = Date.UTC(2026, 7, 18, 8, 0, 0);

function ev(partial: Partial<EligibilityEvent> & { sessionKey: string; timestamp: number }): EligibilityEvent {
  return {
    pageLocation: "https://goodsnova.com/",
    pageReferrer: "",
    ...partial,
  };
}

test("checkout and web-pixels are internal noise, not Direct", () => {
  const checkout = ev({
    sessionKey: "s1",
    timestamp: T0,
    pageLocation: "https://goodsnova.com/checkouts/cn/abc",
  });
  const pixel = ev({
    sessionKey: "s1",
    timestamp: T0,
    pageLocation: "https://goodsnova.com/web-pixels@shopify/foo",
  });
  assert.equal(isInternalNoise(checkout), true);
  assert.equal(isInternalNoise(pixel), true);
  assert.equal(isRealDirect(checkout), false);
  assert.equal(isTouchEligible(checkout), false);
});

test("own-domain self-referral without click id is internal noise, not Direct", () => {
  const hop = ev({
    sessionKey: "s2",
    timestamp: T0,
    pageLocation: "https://goodsnova.com/products/serum",
    pageReferrer: "https://goodsnova.com/collections/all",
  });
  assert.equal(isInternalNoise(hop), true);
  assert.equal(classifyEligibleChannel(hop) === "Direct", false);
});

test("real Direct is empty-referrer storefront with no paid click or UTM", () => {
  const direct = ev({
    sessionKey: "s3",
    timestamp: T0,
    pageLocation: "https://goodsnova.com/",
    pageReferrer: "",
  });
  assert.equal(isInternalNoise(direct), false);
  assert.equal(isRealDirect(direct), true);
  assert.equal(classifyEligibleChannel(direct), "Direct");
});

test("UNKNOWN is not coerced to Direct when there is no reliable touch", () => {
  const blank = ev({
    sessionKey: "s4",
    timestamp: T0,
    pageLocation: null,
    pageReferrer: null,
  });
  assert.equal(isRealDirect(blank), false);
  assert.equal(classifyEligibleChannel(blank), "Unknown");
});

test("Meta then checkout in the same session collapses to one Meta touch", () => {
  const touches = collapseEventsToSessionTouches([
    ev({
      sessionKey: "sess-meta",
      timestamp: T0,
      pageLocation: "https://goodsnova.com/?fbclid=abc",
      fbclid: "abc",
    }),
    ev({
      sessionKey: "sess-meta",
      timestamp: T0 + 60_000,
      eventName: "page_view",
      pageLocation: "https://goodsnova.com/products/serum",
      pageReferrer: "https://goodsnova.com/?fbclid=abc",
    }),
    ev({
      sessionKey: "sess-meta",
      timestamp: T0 + 120_000,
      eventName: "add_to_cart",
      pageLocation: "https://goodsnova.com/products/serum",
      pageReferrer: "https://goodsnova.com/products/serum",
    }),
    ev({
      sessionKey: "sess-meta",
      timestamp: T0 + 180_000,
      eventName: "begin_checkout",
      pageLocation: "https://goodsnova.com/checkouts/cn/xyz",
    }),
    ev({
      sessionKey: "sess-meta",
      timestamp: T0 + 240_000,
      eventName: "purchase",
      pageLocation: "https://goodsnova.com/checkouts/cn/xyz",
    }),
  ]);
  assert.equal(touches.length, 1);
  assert.equal(touches[0].channel, "Facebook / Meta Ads");
  assert.equal(touches[0].id, "sess-meta");
});

test("duplicate event rows in one session collapse to one session touch", () => {
  const touches = collapseEventsToSessionTouches([
    ev({
      sessionKey: "dup",
      timestamp: T0,
      pageLocation: "https://goodsnova.com/?fbclid=1",
      fbclid: "1",
    }),
    ev({
      sessionKey: "dup",
      timestamp: T0,
      pageLocation: "https://goodsnova.com/?fbclid=1",
      fbclid: "1",
    }),
  ]);
  assert.equal(touches.length, 1);
});

test("cross-session journey keeps Meta then genuine Direct", () => {
  const touches = collapseEventsToSessionTouches([
    ev({
      sessionKey: "a",
      timestamp: T0,
      pageLocation: "https://goodsnova.com/?fbclid=z",
      fbclid: "z",
    }),
    ev({
      sessionKey: "b",
      timestamp: T0 + 86_400_000,
      pageLocation: "https://goodsnova.com/",
      pageReferrer: "",
    }),
  ]);
  assert.deepEqual(
    touches.map((touch) => touch.channel),
    ["Facebook / Meta Ads", "Direct"],
  );
});

test("payment processor referrer is internal noise", () => {
  const paypal = ev({
    sessionKey: "pay",
    timestamp: T0,
    pageLocation: "https://goodsnova.com/cart",
    pageReferrer: "https://www.paypal.com/checkoutnow",
  });
  assert.equal(isInternalNoise(paypal), true);
});
