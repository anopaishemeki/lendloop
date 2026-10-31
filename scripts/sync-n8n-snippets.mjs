// Copies shared Code-node snippets (n8n/snippets/<name>.js) into every workflow
// node that marks a spot for them:
//
//   // <snippet:email-layout>
//   ...replaced on every sync...
//   // </snippet:email-layout>
//
// n8n Code nodes can't import files, so this keeps one source of truth.
// Run `npm run sync:n8n` after editing a snippet; the unit tests fail on drift.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const SNIPPETS = path.join(ROOT, "n8n/snippets");
const WORKFLOWS = path.join(ROOT, "n8n/workflows");

/** Absolute paths of the exported workflow JSON files. */
export function workflowFiles() {
  return readdirSync(WORKFLOWS)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(WORKFLOWS, file));
}

export function snippetBlocks() {
  return readdirSync(SNIPPETS)
    .filter((file) => file.endsWith(".js"))
    .map((file) => ({
      body: readFileSync(path.join(SNIPPETS, file), "utf8").trimEnd(),
      name: path.basename(file, ".js"),
    }));
}

export function applySnippets(code, snippets) {
  let next = code;
  for (const { name, body } of snippets) {
    const open = `// <snippet:${name}>`;
    const close = `// </snippet:${name}>`;
    const start = next.indexOf(open);
    if (start === -1) continue;
    const end = next.indexOf(close, start);
    if (end === -1) throw new Error(`Unclosed ${open}`);
    next = `${next.slice(0, start)}${open}\n${body}\n${next.slice(end)}`;
  }
  return next;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const snippets = snippetBlocks();
  let changed = 0;
  for (const file of workflowFiles()) {
    const before = readFileSync(file, "utf8");
    const workflow = JSON.parse(before);
    for (const node of workflow.nodes) {
      if (node.parameters?.jsCode) {
        node.parameters.jsCode = applySnippets(
          node.parameters.jsCode,
          snippets
        );
      }
    }
    const after = `${JSON.stringify(workflow, null, 2)}\n`;
    if (after !== before) {
      writeFileSync(file, after);
      changed += 1;
    }
  }
  console.log(
    `Synced ${snippets.length} snippet(s); ${changed} file(s) updated`
  );
}
