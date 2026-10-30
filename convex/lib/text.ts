import { fail } from "../auth";

// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting them is the point.
const CONTROL_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F]/u;

/** Trims and length-checks free text; rejects control characters other than newlines. */
export function cleanText(
  value: string,
  field: string,
  min: number,
  max: number
): string {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    fail("INVALID_ARGUMENT", `${field} must be at least ${min} characters.`);
  }
  if (trimmed.length > max) {
    fail("INVALID_ARGUMENT", `${field} must be at most ${max} characters.`);
  }
  if (CONTROL_CHARS.test(trimmed)) {
    fail("INVALID_ARGUMENT", `${field} contains unsupported characters.`);
  }
  return trimmed;
}
