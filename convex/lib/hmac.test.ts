import { createHmac } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  MAX_SKEW_SECONDS,
  signingString,
  signRequest,
  verifyRequest,
} from "./hmac";

const SECRET = "test-secret";
const NOW = 1_800_000_000_000;
const request = { body: '{"a":1}', method: "POST", path: "/n8n/reminders" };

async function signed(overrides: Partial<typeof request> = {}, now = NOW) {
  const { signature, timestamp } = await signRequest(
    SECRET,
    { ...request, ...overrides },
    now
  );
  return { ...request, signature, timestamp };
}

describe("signRequest", () => {
  test("matches what an n8n Code node computes with node:crypto", async () => {
    const { signature, timestamp } = await signRequest(SECRET, request, NOW);
    const expected = createHmac("sha256", SECRET)
      .update(`${timestamp}.POST./n8n/reminders.{"a":1}`)
      .digest("hex");
    expect(timestamp).toBe("1800000000");
    expect(signature).toBe(`v1=${expected}`);
    expect(signingString(timestamp, request)).toBe(
      `${timestamp}.POST./n8n/reminders.{"a":1}`
    );
  });
});

describe("verifyRequest", () => {
  test("accepts a fresh, untampered request", async () => {
    expect(await verifyRequest(SECRET, await signed(), NOW)).toEqual({
      ok: true,
    });
  });

  test.each([
    ["body", { body: '{"a":2}' }],
    ["method", { method: "GET" }],
    ["path", { path: "/n8n/overdue-loans" }],
  ])("rejects a changed %s", async (_field, change) => {
    const original = await signed();
    expect(
      await verifyRequest(SECRET, { ...original, ...change }, NOW)
    ).toEqual({ ok: false, reason: "mismatch" });
  });

  test("rejects the wrong secret", async () => {
    expect(await verifyRequest("other", await signed(), NOW)).toEqual({
      ok: false,
      reason: "mismatch",
    });
  });

  test("rejects requests outside the freshness window", async () => {
    const old = await signed({}, NOW - (MAX_SKEW_SECONDS + 1) * 1000);
    const future = await signed({}, NOW + (MAX_SKEW_SECONDS + 1) * 1000);
    expect(await verifyRequest(SECRET, old, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
    expect(await verifyRequest(SECRET, future, NOW)).toEqual({
      ok: false,
      reason: "stale",
    });
  });

  test.each([
    ["missing headers", { signature: null, timestamp: null }, "missing"],
    ["no v1 prefix", { signature: "abc" }, "malformed"],
    ["non-hex mac", { signature: "v1=zz" }, "malformed"],
    ["non-numeric timestamp", { timestamp: "soon" }, "malformed"],
  ] as const)("rejects %s", async (_label, change, reason) => {
    const original = await signed();
    expect(
      await verifyRequest(SECRET, { ...original, ...change }, NOW)
    ).toEqual({ ok: false, reason });
  });
});
