# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

LendLoop is a neighborhood tool-lending board: Next.js 16 (App Router), strict TypeScript, Clerk, Convex, n8n (Cloud; self-hosted also works) and Resend (user email sent from n8n; ops alerts sent from Convex). `README.md` holds the full spec and design decisions; `n8n/README.md` covers workflow import and node-by-node configuration.

## Working rules

- Use **npm / npx only, never bun/bunx** (Bun is broken on the user's machines).
- GitHub account for git and gh: **anopaishemeki**. Repo-local identity: `anopaishemeki <60002356+anopaishemeki@users.noreply.github.com>`. The gh token needs the `workflow` scope because of `.github/workflows/ci.yml`.
- Each change goes on its own branch off an up-to-date `main` (`feat/…`, `fix/…`, `docs/…`).
- Granular Conventional Commits. **No AI attribution anywhere**: no `Co-Authored-By`, no "Generated with" lines in commits or PRs.
- Before publishing a branch, run `/code-review` and then `/simplify`, and fix everything they find.
- Run the full local gate before pushing: `npm run lint && npm run typecheck && npm test && npm run check:n8n && npm run build`.
- Then push, `gh pr create`, wait for CI, `gh pr merge --squash --delete-branch`, and pull `main`.
- The Bash tool mangles backslashes and apostrophes in heredocs. Write files with Write/Edit (or a Python script file).
- Keep Convex changes backward compatible (new args and fields optional): the live Vercel app uses the dev deployment, and `npx convex dev` reaches it before the frontend that expects a breaking change is deployed. After each merge, push Convex again from `main`.

## Commands

```bash
npm run dev                 # Next.js dev server (http://localhost:3000)
npx convex dev              # sync Convex functions to the dev deployment (run alongside)
npm run lint / lint:fix     # Biome via ultracite
npm run typecheck           # next typegen + tsc for app, convex/, and convex test tsconfigs
npm test                    # all Vitest projects
npm run test:convex         # convex-test specs only (convex/**/*.test.ts, edge-runtime)
npm run test:unit           # tests/unit/** (node): route rules + n8n Code-node tests
npm run test:e2e            # Playwright (tests/e2e) against :3000 or E2E_BASE_URL; staging data
npx vitest run convex/loans.test.ts        # single file
npx vitest run convex/loans.test.ts -t "approve"   # single test by name
npm run check:n8n           # scan n8n/workflows/*.json for secrets and credential IDs
npm run sync:n8n            # copy n8n/snippets/*.js into the Code nodes that mark them
npx convex run notifications:redriveFailed # resend failed n8n notification events
npx convex run seed:demo    # demo data (seed:removeDemo undoes it; seed:removeE2E clears e2e leftovers)
npx convex run loans:setNote '{"loanId":"…","note":"…"}'   # correct a loan note (no in-app edit)
npx convex run migrations:backfillToolCopies   # one-off backfills; full list in README "Maintenance commands"
```

## Architecture

**Auth and roles.** Clerk signs users in; `ConvexProviderWithClerk` sends a JWT from the Clerk `convex` template, verified by `convex/auth.config.ts`. The admin role comes from Clerk `publicMetadata.role = "admin"`, carried as the JWT `metadata` claim and read by `convex/lib/roles.ts`. Roles are never stored in Convex or taken from client args. The Convex profile row is created by `users.syncCurrentUser` after sign-in, and signed-in pages wait for it (`src/components/profile-gate.tsx`). `src/proxy.ts` protects routes and redirects non-admins from `/admin` only when the session token carries the `metadata` claim; otherwise `AdminShell` shows "Admins only" from the Convex role. Route rules live in `src/lib/route-access.ts`.

**Route groups.** `src/app/(app)` is the signed-in app (header nav, `/tools`, `/my/*`). `src/app/(admin)/admin` is the admin portal: `AdminShell` (sidebar + outlet) with Overview, Loans, Listings, Reports, Neighbors and Automation pages backed by `convex/admin.ts`.

**Business rules live in Convex, not React.** Every query and mutation starts with a guard from `convex/auth.ts` (`requireViewer`, `requireAdmin`, `assertToolOwner`, `assertLoanParty`, …). Errors are thrown as `ConvexError({ code, message })` via `fail()` so the UI can show toasts. Always import `mutation`/`internalMutation` from `convex/functions.ts`, never `./_generated/server` (lint enforces it): the wrapper runs triggers that keep the admin overview counters in `convex/lib/counters.ts` current. `newTest()` makes `t.run` writes update the counters too. Queries return server-computed action flags (`canApprove`, `canCancel`, …) that the UI only renders. The public landing-page query's `returns` validator only lets `{name, category}` through, so keep data minimization in mind when touching it.

**Copies of tool fields.** Loans and reports keep a copy of their tool's name, category and condition (`toolFieldsOf` in `convex/lib/tools.ts`) so admin filters can page on the server. A trigger on `tools` (`syncToolCopies`, registered in `convex/functions.ts`) refreshes the copies whenever those fields change; set them on any new loan or report insert.

**Reports, limits, alerts.** Listing reports live in `convex/reports.ts`; removing a listing goes through `removeListing` (`convex/lib/listings.ts`), which closes open reports only when an admin removes it. Per-user rate limits are in `convex/lib/limits.ts` (`enforceRateLimit`, after validation; admins exempt). Failed deliveries and reminders insert `pendingAlerts` rows (`convex/lib/alerts.ts`), emailed in one batch every 5 minutes by `convex/alerts.ts` through Resend.

**Loans.** The state machine is in `convex/lib/loans.ts`. **Only `transitionLoan` changes a loan's status**, and it also writes the notification outbox row and enqueues delivery. Dates are UTC calendar days (`YYYY-MM-DD`). Overdue is derived (approved and past its end date), never stored, and overdue loans keep blocking availability until returned. Approving a request declines overlapping pending requests in the same transaction. Removing a tool is a soft delete.

**Convex → n8n (request notifications).** `notificationOutbox` rows are delivered by a `@convex-dev/workpool` action (`convex/notifications.ts`, pool `notificationPool`), which POSTs a minimal HMAC-signed payload (`convex/lib/hmac.ts`) to the n8n production webhook `/webhook/lendloop/request-events`; `onComplete` records sent/failed. Mutations never wait on n8n.

**n8n → Convex (overdue reminders).** `convex/http.ts` exposes signed HTTP actions: `GET /n8n/overdue-loans` (signed response; each request signature is single-use, purged by `convex/crons.ts`) and `POST /n8n/reminders` (idempotent, at most one reminder per loan per UTC day). Each direction uses its own secret (`N8N_OUTBOUND_SECRET` / `N8N_INBOUND_SECRET` in Convex; `LENDLOOP_OUTBOUND_SECRET` / `LENDLOOP_INBOUND_SECRET` in n8n). `loans.activity` surfaces this automation history on loan cards.

**n8n workflows** (`n8n/workflows/*.json`) are instance-agnostic and contain no credentials. Their Code-node JavaScript lives inside the JSON. Shared Code-node code lives in `n8n/snippets/`: edit it there and run `npm run sync:n8n`, never between `// <snippet:name>` markers (details in `n8n/README.md`). After editing, run `npm run check:n8n` and `npm run test:unit`: `tests/unit/n8n-workflows.test.ts` runs each node in a `vm` sandbox with only n8n's globals and `require` limited to `NODE_FUNCTION_ALLOW_BUILTIN`, against the Convex HMAC helpers, and fails if a snippet copy drifts. n8n 1.x quirks are handled (no `URL` global in Code nodes; HTTP text responses pinned to `body`).

## Testing

Convex specs use convex-test through `newTest()` in `convex/test.setup.ts`, which registers the workpool, rate-limiter and aggregate components. Use `t.withIdentity(identityFor("alice", "admin"))` to act as a user; `identityFor` mirrors the Clerk `metadata` claim. The `import.meta.glob("./**/*.*s")` pattern there must not change.

End-to-end specs (`tests/e2e`, Playwright + `@clerk/testing`) sign in as three Clerk users created by `global-setup.ts` and write to the dev (staging) deployment; keep each run self-cleaning (fresh listing name, removed in `afterAll`).

## Known open items

- The dev deployment is both the live demo backend and e2e staging, so the CI e2e job is manual-only; a separate staging deployment would let it run on every push.
- Optional: sign a fixed route name instead of the URL pathname for request events, so n8n needn't parse the webhook URL (changes the signing contract on both sides).
