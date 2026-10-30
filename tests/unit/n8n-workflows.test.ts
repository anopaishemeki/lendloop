import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, test } from "vitest";
import { signRequest, verifyRequest } from "../../convex/lib/hmac";

type N8nNode = {
  name: string;
  type: string;
  parameters: { jsCode?: string };
};

const ROOT = path.resolve(import.meta.dirname, "../..");
const WORKFLOWS = path.join(ROOT, "n8n/workflows");
// The builtins Code nodes may require, from the same setting n8n runs with.
const ALLOWED_BUILTINS = new Set(
  readFileSync(path.join(ROOT, "docker-compose.yml"), "utf8")
    .split("\n")
    .find((line) => line.trim().startsWith("NODE_FUNCTION_ALLOW_BUILTIN:"))
    ?.split(":")[1]
    ?.trim()
    .split(",")
);
const nodeRequire = createRequire(import.meta.url);
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

/**
 * Runs an n8n Code node body in a fresh context holding only the globals n8n's
 * sandbox provides (checked on n8n 1.123) plus the node's own, so code that
 * relies on anything else (URL, fetch, a disallowed builtin) fails here too.
 */
async function runCode(
  js: string,
  globals: Record<string, unknown>,
  self: unknown = {}
) {
  const context = vm.createContext({
    atob,
    Buffer,
    btoa,
    console,
    setTimeout,
    TextDecoder,
    TextEncoder,
    ...globals,
    require: (name: string) => {
      if (!ALLOWED_BUILTINS.has(name)) {
        throw new Error(`Module '${name}' is disallowed`);
      }
      return nodeRequire(name);
    },
  });
  const fn = vm.runInContext(`(async function () {\n${js}\n})`, context) as (
    this: unknown
  ) => Promise<{ json: Record<string, unknown> }[]>;
  return await fn.call(self);
}

async function verify(
  body: string,
  headers: Record<string, string>,
  {
    secret = SECRET,
    webhookUrl = WEBHOOK_URL,
  }: { secret?: string; webhookUrl?: string | null } = {}
) {
  const [result] = await runCode(
    codeOf("lendloop-request-notifications.json", "Verify signature"),
    {
      $input: {
        first: () => ({ json: { body: {}, headers, webhookUrl } }),
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
      (await verify(body, await signedHeaders(body), { secret: "other" }))
        ?.reason
    ).toBe("mismatch");
    expect(
      (await verify(body, await signedHeaders(body, Date.now() - 600_000)))
        ?.reason
    ).toBe("stale");
    expect((await verify(body, {}))?.reason).toBe("missing signature");
  });

  test("refuses to guess when the raw body is unavailable", async () => {
    const [result] = await runCode(
      codeOf("lendloop-request-notifications.json", "Verify signature"),
      {
        $input: {
          first: () => ({
            json: {
              body: JSON.parse(body),
              headers: {},
              webhookUrl: WEBHOOK_URL,
            },
          }),
        },
        $vars: { LENDLOOP_OUTBOUND_SECRET: SECRET },
      },
      {
        helpers: {
          getBinaryDataBuffer: () => {
            throw new Error("no binary");
          },
        },
      }
    );
    expect(String(result?.json.reason)).toContain("no raw body");
  });

  test("fails closed when the n8n variable is not set", async () => {
    expect(
      (await verify(body, await signedHeaders(body), { secret: "" }))?.reason
    ).toBe("not configured");
  });

  test("signs over the webhook path whatever the origin, query or fragment", async () => {
    const headers = await signedHeaders(body);
    for (const url of [
      "http://localhost:5678/webhook/lendloop/request-events",
      "https://n8n.example/webhook/lendloop/request-events?x=1#top",
    ]) {
      expect((await verify(body, headers, { webhookUrl: url }))?.valid).toBe(
        true
      );
    }
    expect(
      (await verify(body, headers, { webhookUrl: "https://n8n.example/other" }))
        ?.reason
    ).toBe("mismatch");
  });

  test("rejects instead of crashing when the webhook URL is missing", async () => {
    expect(
      (await verify(body, await signedHeaders(body), { webhookUrl: null }))
        ?.reason
    ).toBe("no webhook URL");
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
      },
      occurredAt: "2026-10-30T10:00:00.000Z",
      recipient: { email: "olive@example.test", firstName: "Olive" },
      toolName: "Drill",
    };
    const [email] = await runCode(
      codeOf("lendloop-request-notifications.json", "Build email"),
      {
        $input: { first: () => ({ json: { payload } }) },
        $vars: { RESEND_FROM: "LendLoop <hi@lendloop.example>" },
      }
    );
    expect(email?.json).toMatchObject({
      eventId: "evt1",
      from: "LendLoop <hi@lendloop.example>",
      subject: "Ben would like to borrow your Drill",
      to: "olive@example.test",
    });
    expect(email?.json.text).toContain(payload.appUrl);
  });
});

describe("request notifications: Classify failure node", () => {
  test.each([
    [{ httpCode: "422", message: "Invalid `to` field" }, false],
    [{ message: "403 - forbidden" }, false],
    [{ httpCode: "503", message: "Service unavailable" }, true],
    [{ httpCode: "429", message: "Too many requests" }, true],
    [{ message: "socket hang up" }, true],
  ])("%o -> retryable %s", async (error, retryable) => {
    const [result] = await runCode(
      codeOf("lendloop-request-notifications.json", "Classify failure"),
      { $input: { first: () => ({ json: { error } }) } }
    );
    expect(result?.json.retryable).toBe(retryable);
  });
});

describe("overdue reminders: signing and verification nodes", () => {
  const FILE = "lendloop-overdue-reminders.json";
  const INBOUND = "inbound-secret";
  const vars = {
    LENDLOOP_CONVEX_SITE_URL: "https://demo.convex.site/",
    LENDLOOP_INBOUND_SECRET: INBOUND,
  };

  test("Sign request produces a GET signature Convex accepts", async () => {
    const [signed] = await runCode(codeOf(FILE, "Sign request"), {
      $vars: vars,
    });
    expect(signed?.json.url).toBe("https://demo.convex.site/n8n/overdue-loans");
    expect(
      await verifyRequest(INBOUND, {
        body: "",
        method: "GET",
        path: "/n8n/overdue-loans",
        signature: String(signed?.json.signature),
        timestamp: String(signed?.json.timestamp),
      })
    ).toEqual({ ok: true });
  });

  test("Verify response splits a signed Convex response into loans", async () => {
    const body = JSON.stringify({
      appUrl: "https://lendloop.example/my/requests",
      loans: [{ loanId: "a" }, { loanId: "b" }],
      reminderDate: "2026-10-30",
    });
    const { signature, timestamp } = await signRequest(INBOUND, {
      body,
      method: "RESPONSE",
      path: "/n8n/overdue-loans",
    });
    const headers = {
      "x-lendloop-signature": signature,
      "x-lendloop-timestamp": timestamp,
    };
    const verifyResponse = ({
      sent = headers,
      text = body,
      settings = vars,
    }: {
      sent?: Record<string, string>;
      text?: string;
      settings?: Record<string, string>;
    }) =>
      runCode(codeOf(FILE, "Verify response"), {
        $input: { first: () => ({ json: { body: text, headers: sent } }) },
        $vars: settings,
      });

    const items = await verifyResponse({});
    expect(items.map((item) => item.json)).toEqual([
      {
        appUrl: "https://lendloop.example/my/requests",
        loanId: "a",
        reminderDate: "2026-10-30",
      },
      {
        appUrl: "https://lendloop.example/my/requests",
        loanId: "b",
        reminderDate: "2026-10-30",
      },
    ]);

    await expect(
      verifyResponse({ text: body.replace('"a"', '"z"') })
    ).rejects.toThrow(/does not match/u);
    await expect(verifyResponse({ sent: {} })).rejects.toThrow(/not signed/u);
    await expect(verifyResponse({ settings: {} })).rejects.toThrow(
      /LENDLOOP_INBOUND_SECRET is not set/u
    );
  });

  test("Sign write-back produces a POST signature Convex accepts", async () => {
    const outcome = {
      loanId: "loan1",
      reminderDate: "2026-10-30",
      status: "sent",
    };
    // "Run once for each item" nodes return a single item, not an array.
    const signed = (await runCode(codeOf(FILE, "Sign write-back"), {
      $json: outcome,
      $vars: vars,
    })) as unknown as { json: Record<string, unknown> };
    expect(JSON.parse(String(signed.json.body))).toEqual(outcome);
    expect(signed.json.url).toBe("https://demo.convex.site/n8n/reminders");
    expect(
      await verifyRequest(INBOUND, {
        body: String(signed.json.body),
        method: "POST",
        path: "/n8n/reminders",
        signature: String(signed.json.signature),
        timestamp: String(signed.json.timestamp),
      })
    ).toEqual({ ok: true });
  });
});

describe("overdue reminders: Record outcome node", () => {
  const FILE = "lendloop-overdue-reminders.json";
  const built = {
    json: {
      loanId: "loan1",
      reminderDate: "2026-10-30",
      to: "ben@example.test",
    },
  };
  const run = (json: Record<string, unknown>) =>
    runCode(codeOf(FILE, "Record outcome"), {
      $: () => ({ item: built }),
      $json: json,
    }) as unknown as Promise<{ json: Record<string, unknown> }>;

  test("a successful send becomes status sent", async () => {
    expect((await run({ id: "re_123" })).json).toEqual({
      loanId: "loan1",
      reminderDate: "2026-10-30",
      status: "sent",
    });
  });

  test("an error item becomes status failed with the message", async () => {
    expect((await run({ error: { message: "503 unavailable" } })).json).toEqual(
      {
        error: "503 unavailable",
        loanId: "loan1",
        reminderDate: "2026-10-30",
        status: "failed",
      }
    );
  });
});

describe("settings fallback for self-hosted n8n", () => {
  const SITE = "https://demo.convex.site";

  async function signWith(globals: Record<string, unknown>) {
    const [signed] = await runCode(
      codeOf("lendloop-overdue-reminders.json", "Sign request"),
      globals
    );
    return signed?.json;
  }

  async function signatureValid(
    secret: string,
    json: Record<string, unknown> | undefined
  ) {
    return (
      await verifyRequest(secret, {
        body: "",
        method: "GET",
        path: "/n8n/overdue-loans",
        signature: String(json?.signature),
        timestamp: String(json?.timestamp),
      })
    ).ok;
  }

  test("reads environment variables when n8n Variables are unavailable", async () => {
    const json = await signWith({
      $env: { LENDLOOP_CONVEX_SITE_URL: SITE, LENDLOOP_INBOUND_SECRET: "env" },
      $vars: {},
    });
    expect(await signatureValid("env", json)).toBe(true);
  });

  test("prefers n8n Variables over environment variables", async () => {
    const json = await signWith({
      $env: { LENDLOOP_CONVEX_SITE_URL: SITE, LENDLOOP_INBOUND_SECRET: "env" },
      $vars: {
        LENDLOOP_CONVEX_SITE_URL: SITE,
        LENDLOOP_INBOUND_SECRET: "vars",
      },
    });
    expect(await signatureValid("vars", json)).toBe(true);
  });

  test("names the missing setting when neither source has it", async () => {
    await expect(signWith({ $vars: {} })).rejects.toThrow(
      /LENDLOOP_INBOUND_SECRET is not set/u
    );
  });

  test("Verify signature treats blocked env access as not configured", async () => {
    const [result] = await runCode(
      codeOf("lendloop-request-notifications.json", "Verify signature"),
      {
        $env: new Proxy(
          {},
          {
            get: () => {
              throw new Error("access to env vars denied");
            },
          }
        ),
        $input: {
          first: () => ({ json: { headers: {}, webhookUrl: WEBHOOK_URL } }),
        },
        $vars: {},
      },
      { helpers: { getBinaryDataBuffer: async () => Buffer.from("{}") } }
    );
    expect(result?.json.reason).toBe("not configured");
  });
});
