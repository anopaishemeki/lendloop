// Fails if an exported n8n workflow carries credential ids or secret-looking
// values. Run before committing exports: `npm run check:n8n`.
import { readFileSync } from "node:fs";
import path from "node:path";
import { workflowFiles } from "./sync-n8n-snippets.mjs";

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
const files = workflowFiles();

for (const filePath of files) {
  const file = path.basename(filePath);
  const text = readFileSync(filePath, "utf8");
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
  if (Object.keys(workflow.pinData ?? {}).length > 0) {
    problems.push(`${file}: pinned execution data may contain personal data`);
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
