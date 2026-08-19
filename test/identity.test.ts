import assert from "node:assert/strict";
import test from "node:test";
import { identityEvidence } from "../src/lib/attribution/identity.ts";

test("presence alone is PRESENT, not STITCHED", () => {
  const evidence = identityEvidence({
    personKey: "cid:abc",
    clientId: "abc",
    transactionId: "1001",
    gnUid: "gn-1",
    hashedEmailPresent: true,
  });
  const gn = evidence.fields.find((field) => field.key === "gn_uid");
  assert.equal(gn?.status, "PRESENT");
  assert.equal(evidence.confidence, "partial");
  assert.doesNotMatch(evidence.summary, /matched/i);
});

test("winning gn_uid is STITCHED", () => {
  const evidence = identityEvidence({
    personKey: "gn:gn-1",
    gnUid: "gn-1",
    transactionId: "1001",
    hashedEmailPresent: true,
  });
  assert.equal(evidence.fields.find((field) => field.key === "gn_uid")?.status, "STITCHED");
  assert.equal(
    evidence.fields.find((field) => field.key === "hashed_email")?.status,
    "CORROBORATED",
  );
  assert.equal(evidence.confidence, "high");
});

test("missing identifiers stay MISSING", () => {
  const evidence = identityEvidence({
    personKey: null,
    transactionId: null,
  });
  assert.equal(evidence.fields.find((field) => field.key === "gn_uid")?.status, "MISSING");
  assert.equal(evidence.confidence, "low");
});

test("hashed email display is never plaintext", () => {
  const evidence = identityEvidence({
    personKey: "email:deadbeef",
    hashedEmailPresent: true,
    transactionId: "1001",
  });
  const hashed = evidence.fields.find((field) => field.key === "hashed_email");
  assert.equal(hashed?.display, "present");
  assert.notEqual(hashed?.display, "deadbeef");
});
