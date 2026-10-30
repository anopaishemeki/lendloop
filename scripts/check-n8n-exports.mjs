// Fails if an exported n8n workflow carries credential ids or secret-looking
// values. Run before committing exports: `npm run check:n8n`.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(import.meta.dirname, "../n8n/workflows");

const SECRET_PATTERNS = [
  ["Resend API key", /\bre_[A-Za-z0-9_]{16,}/u],
  ["bearer token", /Bearer\s+[A-Za-z0-9._-]{16,}/u],
  ["64-char hex secret", /\b[0-9a-f]{64}\b/u],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  [
    "literal secret field",
    /"(?:secret|password|apiKey|token)"\s*:\s*"[^"={][^"]*"/iu,
  ],
];

const problems = [];
const files = readdirSync(DIR).filter((file) => file.endsWith(".json"));

for (const file of files) {
  const text = readFileSync(path.join(DIR, file), "utf8");
  const workflow = JSON.parse(text);

  for (const node of workflow.nodes ?? []) {
    for (const [type, credential] of Object.entries(node.credentials ?? {})) {
      if (credential.id) {
        problems.push(
          `${file}: node "${node.name}" keeps ${type} credential id`
        );
      }
    }
  }
  for (const [label, pattern] of SECRET_PATTERNS) {
    if (pattern.test(text))
      problems.push(`${file}: looks like it contains a ${label}`);
  }
  for (const key of ["id", "versionId", "meta"]) {
    if (key in workflow)
      problems.push(`${file}: instance-specific "${key}" present`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`n8n exports clean (${files.length} files checked)`);
