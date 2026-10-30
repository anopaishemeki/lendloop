import path from "node:path";
import { defineConfig } from "vitest/config";

const ROOT = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(ROOT, "src") },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          environment: "edge-runtime",
          include: ["convex/**/*.test.ts"],
          name: "convex",
          // convex-test and the @convex-dev/*/test helpers ship TypeScript that
          // calls import.meta.glob, so Vite must transform them.
          server: { deps: { inline: ["convex-test", /@convex-dev\//u] } },
        },
      },
      {
        extends: true,
        test: {
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          name: "unit",
        },
      },
    ],
  },
});
