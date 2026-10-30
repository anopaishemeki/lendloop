// Request signing shared by both directions (Convex -> n8n and n8n -> Convex).
//
//   X-LendLoop-Timestamp: <unix seconds>
//   X-LendLoop-Signature: v1=<hex HMAC-SHA256(secret, "<ts>.<METHOD>.<path>.<raw body>")>
//
// Covering method and path stops a signature for one endpoint being replayed
// against another; the timestamp bounds replays of the same request.

export const TIMESTAMP_HEADER = "x-lendloop-timestamp";
export const SIGNATURE_HEADER = "x-lendloop-signature";
export const MAX_SKEW_SECONDS = 300;

const SIGNATURE_PREFIX = "v1=";
const HEX = /^[0-9a-f]+$/u;
const encoder = new TextEncoder();

export type SignedRequest = {
  method: string;
  path: string;
  body: string;
};

export function signingString(
  timestamp: string,
  { method, path, body }: SignedRequest
): string {
  return `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(mac), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signRequest(
  secret: string,
  request: SignedRequest,
  nowMs = Date.now()
): Promise<{ timestamp: string; signature: string }> {
  const timestamp = Math.floor(nowMs / 1000).toString();
  const mac = await hmacHex(secret, signingString(timestamp, request));
  return { signature: `${SIGNATURE_PREFIX}${mac}`, timestamp };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "malformed" | "stale" | "mismatch" };

export async function verifyRequest(
  secret: string,
  request: SignedRequest & {
    timestamp: string | null;
    signature: string | null;
  },
  nowMs = Date.now()
): Promise<VerifyResult> {
  const { timestamp, signature } = request;
  if (!(timestamp && signature)) return { ok: false, reason: "missing" };

  const seconds = Number(timestamp);
  const mac = signature.startsWith(SIGNATURE_PREFIX)
    ? signature.slice(SIGNATURE_PREFIX.length)
    : "";
  if (!(Number.isInteger(seconds) && HEX.test(mac))) {
    return { ok: false, reason: "malformed" };
  }
  if (Math.abs(nowMs / 1000 - seconds) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "stale" };
  }
  const expected = await hmacHex(secret, signingString(timestamp, request));
  return constantTimeEqual(expected, mac)
    ? { ok: true }
    : { ok: false, reason: "mismatch" };
}
