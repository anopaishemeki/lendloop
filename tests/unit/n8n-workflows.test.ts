import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { signRequest } from "../../convex/lib/hmac";

type N8nNode = {
  name: string;
  type: string;
  parameters: { jsCode?: string };
};

const nodeRequire = createRequire(import.meta.url);
const WORKFLOWS = path.resolve(import.meta.dirname, "../../n8n/workflows");
const SECRET = "shared-outbound-secret";
const WEBHOOK_URL =
  "https://example.app.n8n.cloud/webhook/lendloop/request-events";

function loadWorkflow(file: string): { nodes: N8nNode[] } {
  return JSON.parse(readFileSync(path.join(WORKFLOWS, file), "utf8"));
}

function codeOf(file: string, nodeName: string): string {
  const node = loadWorkflow(file).nodes.find((n) => n.name === nodeName);
  if (!node?.parameters.jsCode) throw new Error(`No code node ${nodeName}`);
  return node.parameters.jsCode;
}

/** Runs an n8n Code node body with the globals n8n provides. */
async function runCode(
  js: string,
  globals: Record<string, unknown>,
  self: unknown = {}
) {
  const AsyncFunction = Object.getPrototypeOf(async () => undefined)
    .constructor as new (
    ...args: string[]
  ) => (...values: unknown[]) => Promise<{ json: Record<string, unknown> }[]>;
  const names = ["require", ...Object.keys(globals)];
  const fn = new AsyncFunction(...names, js);
  return await fn.call(self, nodeRequire, ...Object.values(globals));
}

async function verify(
  body: string,
  headers: Record<string, string>,
  secret = SECRET
) {
  const [result] = await runCode(
    codeOf("lendloop-request-notifications.json", "Verify signature"),
    {
      $input: {
        first: () => ({ json: { body: {}, headers, webhookUrl: WEBHOOK_URL } }),
      },
      $vars: { LENDLOOP_OUTBOUND_SECRET: secret },
    },
    { helpers: { getBinaryDataBuffer: async () => Buffer.from(body) } }
  );
  return result?.json;
}

async function signedHeaders(body: string, nowMs = Date.now()) {
  const { signature, timestamp } = await signRequest(
    SECRET,
    { body, method: "POST", path: "/webhook/lendloop/request-events" },
    nowMs
  );
  return {
    "x-lendloop-signature": signature,
    "x-lendloop-timestamp": timestamp,
  };
}

describe("request notifications: Verify signature node", () => {
  const body = JSON.stringify({ event: "request.created", eventId: "abc" });

  test("accepts what Convex signs and passes only the payload on", async () => {
    expect(await verify(body, await signedHeaders(body))).toEqual({
      payload: { event: "request.created", eventId: "abc" },
      valid: true,
    });
  });

  test("rejects a tampered body", async () => {
    const headers = await signedHeaders(body);
    expect(await verify(body.replace("abc", "xyz"), headers)).toEqual({
      reason: "mismatch",
      valid: false,
    });
  });

  test("rejects the wrong secret, stale requests and missing headers", async () => {
    expect(
      (await verify(body, await signedHeaders(body), "other"))?.reason
    ).toBe("mismatch");
    expect(
      (await verify(body, await signedHeaders(body, Date.now() - 600_000)))
        ?.reason
    ).toBe("stale");
    expect((await verify(body, {}))?.reason).toBe("missing signature");
  });

  test("fails closed when the n8n variable is not set", async () => {
    expect((await verify(body, await signedHeaders(body), ""))?.reason).toBe(
      "not configured"
    );
  });
});

describe("request notifications: Build email node", () => {
  test("writes the email from the minimized payload only", async () => {
    const payload = {
      appUrl: "https://lendloop.example/my/incoming",
      counterpartFirstName: "Ben",
      event: "request.created",
      eventId: "evt1",
      loan: {
        endDate: "2026-11-03",
        startDate: "2026-11-01",
        status: "requested",
      },
      occurredAt: "2026-10-30T10:00:00.000Z",
      recipient: { email: "olive@example.test", firstName: "Olive" },
      toolName: "Drill",
    };
    const [email] = await runCode(
      codeOf("lendloop-request-notifications.json", "Build email"),
      { $input: { first: () => ({ json: { payload } }) } }
    );
    expect(email?.json).toMatchObject({
      eventId: "evt1",
      subject: "Ben would like to borrow your Drill",
      to: "olive@example.test",
    });
    expect(email?.json.text).toContain(payload.appUrl);
  });
});
