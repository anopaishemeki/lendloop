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
// SHA-256 MACs are 32 bytes, so a well-formed v1 signature is 64 hex chars.
const HEX_MAC = /^[0-9a-f]{64}$/u;
const HEX_PAIR = /../gu;
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

function hmacKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    [usage]
  );
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    (hex.match(HEX_PAIR) ?? []).map((pair) => Number.parseInt(pair, 16))
  );
}

export async function signRequest(
  secret: string,
  request: SignedRequest,
  nowMs = Date.now()
): Promise<{ timestamp: string; signature: string }> {
  const timestamp = Math.floor(nowMs / 1000).toString();
  const mac = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    encoder.encode(signingString(timestamp, request))
  );
  const hex = Array.from(new Uint8Array(mac), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return { signature: `${SIGNATURE_PREFIX}${hex}`, timestamp };
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
  if (!(Number.isInteger(seconds) && HEX_MAC.test(mac))) {
    return { ok: false, reason: "malformed" };
  }
  if (Math.abs(nowMs / 1000 - seconds) > MAX_SKEW_SECONDS) {
    return { ok: false, reason: "stale" };
  }
  // subtle.verify compares in constant time.
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    hexToBytes(mac),
    encoder.encode(signingString(timestamp, request))
  );
  return valid ? { ok: true } : { ok: false, reason: "mismatch" };
}
