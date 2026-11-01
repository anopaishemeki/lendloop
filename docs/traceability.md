# Traceability matrix

Every feature in LendLoop, traced to where it is implemented, how it is verified, the pull requests that built it, and its status. Section 1 follows the assignment brief item by item; section 2 lists what was added beyond it; section 3 covers the cross-cutting qualities the brief evaluates.

**Status:** ✅ Done · ⚠️ Done with a noted limitation

**Verified by:**
- **T:** automated tests in CI (convex-test specs in `convex/*.test.ts`, unit tests in `tests/unit/`)
- **E:** Playwright end-to-end tests in `tests/e2e/` (run on demand)
- **L:** checked against the live services (Vercel, Convex, Clerk, n8n Cloud, Resend)
- **M:** checked by hand in a browser

PR numbers refer to https://github.com/anopaishemeki/lendloop/pulls?q=is%3Amerged.

## 1. Assignment requirements

### Public page

| ID | Requirement | Implementation | Verified by | PRs | Status |
|---|---|---|---|---|---|
| R-01 | Company name LendLoop and a short tagline | `src/app/page.tsx` ("Borrow what you need. Lend what you don't.") | E (`public.spec.ts`), M | #2, #10 | ✅ |
| R-02 | Read-only list of available tools from Convex, name and category only, no owner details | `tools.listPublic`; its `returns` validator allows only `{name, category}` | T (`tools.test.ts`: "exposes only name and category of available, listed tools") | #2 | ✅ |
| R-03 | "Sign in to lend or borrow" button wired to Clerk | Clerk `SignInButton` on `/`, landing on `/tools` | E ("the landing page is public and invites sign-in"), M | #2, #15 | ✅ |

### Authenticated experience

| ID | Requirement | Implementation | Verified by | PRs | Status |
|---|---|---|---|---|---|
| R-04 | Only signed-in users reach the app | Clerk proxy (`src/proxy.ts`, `src/lib/route-access.ts`); every Convex function calls `requireViewer` | T (`route-access.test.ts`, `auth.test.ts`), E ("signed-out visitors are sent to sign in") | #1, #13 | ✅ |
| R-05 | List a tool with name, category, condition and short description | `/tools/new`, `tools.create` (validated, trimmed, length-limited) | T (`tools.test.ts`: create), E ("a lender lists a tool") | #2 | ✅ |
| R-06 | Request to borrow for a date range | Request dialog on `/tools` (shows booked dates), `loans.request` (overlap, length and advance-booking rules) | T (`loans.test.ts`: loans.request), E ("a borrower requests it") | #3 | ✅ |
| R-07 | Approve or decline requests on their own tools | `/my/incoming`, `loans.approve` / `loans.decline`; approving declines overlapping pending requests | T (`loans.test.ts`: approve and decline), E ("the lender approves the request") | #3 | ✅ |
| R-08 | Mark a loan as returned | `loans.markReturned` (owner only, once started; works after a listing is removed) | T (`loans.test.ts`: markReturned) | #3 | ✅ |
| R-09 | All tools with availability status, filterable by category | `/tools`, `tools.list` (paginated); category filter kept in the URL | T (`tools.test.ts`: tools.list), M | #2, #18 | ✅ |
| R-10 | "My listings", "My requests" and "Incoming requests" views | `/my/listings`, `/my/requests`, `/my/incoming`; paginated pending, active and history sections | T (`loans.test.ts`: views), E | #2, #3, #18, #31 | ✅ |
| R-11 | Nice, minimal layout | shadcn/ui and Tailwind; light, dark and system themes; responsive down to phone width | M | #10, #16 | ✅ |

### Roles and rules

| ID | Requirement | Implementation | Verified by | PRs | Status |
|---|---|---|---|---|---|
| R-12 | Two roles, user and admin | Role from Clerk `publicMetadata.role`, carried as the JWT `metadata` claim and read only by `convex/lib/roles.ts`; never stored or taken from client arguments | T (`auth.test.ts`: "derives admin only from the exact role claim") | #1, #4 | ✅ |
| R-13 | Admin removes any listing | Admin Listings page, Reports page; `tools.remove` (`assertToolOwnerOrAdmin`) | T (`tools.test.ts`: "admins can remove any listing"; `reports.test.ts`: "an admin removing the listing closes every open report") | #4, #12, #23 | ✅ |
| R-14 | Admin views all loans | Admin Loans page, `admin.listLoans` (paginated, with filters) | T (`admin.test.ts`: admin views, listLoans filters) | #4, #12, #32 | ✅ |
| R-15 | Admin marks a lender as Trusted Lender | Admin Neighbors page, `admin.setTrustedLender`; the badge shows on listings, loans and emails | T (`admin.test.ts`: trusted lender), M | #4, #14 | ✅ |
| R-16 | Users create, edit and delete only their own listings | `assertToolOwner` / `assertToolOwnerOrAdmin` in `tools.update` and `tools.remove` | T (`tools.test.ts`: "only the owner may edit, not other users or admins") | #2 | ✅ |
| R-17 | Users act only on requests involving their own tools or borrowing | `assertLoanParty` and the action rules in `convex/loans.ts`; the UI only shows server-provided action flags | T (`loans.test.ts`: "only the tool owner can decide", "outsiders can't cancel") | #3 | ✅ |
| R-18 | RBAC enforced in Convex functions, not only in the UI | Every query and mutation starts with a guard from `convex/auth.ts`; admin functions call `requireAdmin`; the `/admin` redirect is UX only | T (`admin.test.ts`: "admin queries and mutations reject non-admins"), E ("can't open the admin portal"), L | #1, #4, #13 | ✅ |

### Automation with n8n

| ID | Requirement | Implementation | Verified by | PRs | Status |
|---|---|---|---|---|---|
| R-19 | Request notification: Convex calls an n8n webhook when a request is created or changes status; the user is notified | Outbox + `@convex-dev/workpool` delivery (`convex/notifications.ts`); `n8n/workflows/lendloop-request-notifications.json` emails the person concerned through Resend (HTML and plain text) | T (`notifications.test.ts`: events, delivery; `n8n-workflows.test.ts`), L | #5, #11 | ✅ |
| R-20 | The notification uses only the fields it needs | Minimal payload (recipient's own email and first name, counterpart's first name, tool name, dates, link); no user IDs, notes, status or other party's email | T ("posts a signed, minimal payload", "payload carries no loan status", "writes the email from the minimized payload only") | #5 | ✅ |
| R-21 | Overdue reminders: scheduled daily, fetches overdue loans from a Convex HTTP endpoint, reminds each borrower, writes status back | `GET /n8n/overdue-loans` and `POST /n8n/reminders` (`convex/http.ts`, `convex/reminders.ts`); `n8n/workflows/lendloop-overdue-reminders.json` runs daily at 08:00 UTC and repeats hourly until 17:00 to retry failures and clear backlogs | T (`http.test.ts`), L | #6, #20 | ✅ |
| R-22 | Sign webhook payloads and verify signatures on the receiving side | HMAC-SHA256 over timestamp, method, path and raw body, in both directions with separate secrets (`convex/lib/hmac.ts`; n8n Code nodes); the overdue response is signed too; the overdue GET's signature is single-use | T (`hmac.test.ts`, `http.test.ts`: replay, tampering, stale; `n8n-workflows.test.ts`: Verify signature), L | #5, #6, #9 | ✅ |
| R-23 | Secrets in environment variables and n8n credentials, never in code or exported JSON | Convex env variables, n8n Variables and credentials; `npm run check:n8n` scans exports in CI | T (CI `check:n8n`) | #5, #8 | ✅ |
| R-24 | Idempotent write-backs | `recordReminder` keyed on loan and day: one row per loan per day, "sent" is final; deliveries use a Resend Idempotency-Key | T ("is idempotent per loan and day", "a later failure refreshes the error; success is final") | #6 | ✅ |
| R-25 | Retries and an error workflow so failures are visible and never silent | Workpool retries with backoff; n8n Retry On Fail; Error handler workflow emails ops; failed deliveries visible and retryable in the admin portal; Convex ops alerts (R-X10) | T (`notifications.test.ts`: retries, redrive; `alerts.test.ts`), L | #5, #6, #24 | ✅ |
| R-26 | Bonus: recent automation activity on each loan | `loans.activity`, shown on every loan card ("Overdue reminder sent to you 2 days ago") | T ("shows automation outcomes to the loan's parties only"), M | #7 | ✅ |

### Deliverables

| ID | Deliverable | Where | PRs | Status |
|---|---|---|---|---|
| D-01 | GitHub repository with the app source | https://github.com/anopaishemeki/lendloop (public) | all | ✅ |
| D-02 | Exported n8n workflow JSON in the repository | `n8n/workflows/` (three workflows) plus `n8n/README.md` import guide | #5, #6, #8 | ✅ |
| D-03 | README: local setup including n8n (docker-compose) | README "Local setup"; `docker-compose.yml` | #8 | ✅ |
| D-04 | README: environment variables | README "Environment variables"; `.env.example`, `convex/.env.example` | #8 | ✅ |
| D-05 | README: architecture | README "Architecture" (diagram and data flow) | #8, #37 | ✅ |
| D-06 | README: security and data-minimization decisions | README "Security and data minimization", "Decisions" | #8, #13 | ✅ |
| D-07 | Note on running in production | README "Running in production" | #8, #21, #37 | ✅ |

## 2. Beyond the brief

| ID | Feature | Implementation | Verified by | PRs | Status |
|---|---|---|---|---|---|
| X-01 | Admin portal with its own layout: sidebar and one page per job | `src/app/(admin)/admin`, `AdminShell`: Overview, Loans, Listings, Reports, Neighbors, Automation; "Back to user view" | M, E | #12, #36 | ✅ |
| X-02 | Admin overview from maintained counters (no table scans) | `@convex-dev/aggregate` counters kept current by triggers (`convex/lib/counters.ts`, `convex/functions.ts`) | T ("the overview counts…", "backfillAllCounters restores counts") | #19 | ✅ |
| X-03 | Search and filters on every admin page, kept in the URL | Listings: name, category, condition. Loans: tool name, status (incl. overdue), category, condition. Reports: tool name, status, reason, category, condition. Neighbors: name, trusted only. Automation: email type, delivery status, reminder outcome | T (`admin.test.ts`: filter suites), M | #28, #29, #31, #32, #33, #35 | ⚠️ Availability is not a filter: it's derived from loans and today's date, so it can't page on the server |
| X-04 | Loans and reports keep a copy of their tool's fields, kept in step by a trigger | `convex/lib/tools.ts` (`toolFieldsOf`, `syncToolCopies`), `migrations:backfillToolCopies` | T ("a tool's edits reach its loans…", "copies follow tool edits") | #32, #33 | ✅ |
| X-05 | Pagination on every list | All boards and admin tables paginated with Load more; the landing preview is capped by design | T ("pages newest first", "history pages through…", "admin pagination") | #18, #31 | ✅ |
| X-06 | Report a listing, with an admin review queue | `reports.create` (one per person and listing, rate-limited), Reports page (remove or dismiss), open-reports card | T (`reports.test.ts`), E | #23 | ✅ |
| X-07 | Per-user rate limits | `@convex-dev/rate-limiter` (`convex/lib/limits.ts`): borrow requests, requests per owner, new listings, reports; checked after validation; admins exempt | T (`limits.test.ts`) | #22 | ✅ |
| X-08 | Trusted Lender badge across the app and in emails | Badge on listings, loan cards, admin tables and email templates | T ("shows the Trusted Lender badge for a trusted neighbor"), M | #14 | ✅ |
| X-09 | Styled HTML emails with plain-text versions | Shared layout in `n8n/snippets/`, synced into the workflows by `npm run sync:n8n` | T (`n8n-workflows.test.ts`: Build email, snippet drift check), L | #11 | ✅ |
| X-10 | Ops alerts for failed deliveries and reminders, sent from Convex | `pendingAlerts` rows, emailed in one batch every 5 minutes through Resend (works when n8n is down) | T (`alerts.test.ts`), L (settings configured) | #24 | ✅ |
| X-11 | Two-week outcomes chart and failure stats | Automation page chart (sent/failed per day, accessible); overview counts failed reminders | T ("counts sent and failed deliveries and reminders per day"), M | #24, #27 | ✅ |
| X-12 | Overdue reminders scale past 200 loans | Each run takes up to 200, untried before failed, skipping loans already reminded today; hourly runs work through backlogs | T ("a backlog larger than one run" suite) | #20 | ✅ |
| X-13 | Light, dark and system themes | Theme switcher, Clerk components themed to match | M | #16 | ✅ |
| X-14 | Demo data | `seed:demo` / `seed:removeDemo` (8 neighbors, 16 listings, loans in every state, history, reports); sends nothing | T (`seed.test.ts`), L | #26 | ✅ |
| X-15 | Maintenance commands | `notifications:redriveFailed`, migrations, `loans:setNote`, `reports:setDetails`, `seed:removeE2E` (README "Maintenance commands") | T | #24, #26, #30, #38 | ✅ |
| X-16 | Favicon and home-screen icon | `src/app/icon.svg`, `src/app/apple-icon.png` | L | #29 | ✅ |
| X-17 | Hosting and CI | Vercel (production on `main`, previews per PR); GitHub Actions: lint, typecheck, tests, export scan, build (CI since #1) | L | #1, #17, #21 | ✅ |

## 3. Quality, security and reliability

| ID | Quality | Implementation | Verified by | PRs | Status |
|---|---|---|---|---|---|
| Q-01 | Identity only from Clerk; no caller IDs from the client | `ctx.auth.getUserIdentity()`; profile row via `users.syncCurrentUser` | T (`auth.test.ts`) | #1 | ✅ |
| Q-02 | Data minimization between users | Other users see first names only, never email addresses; admins see full names; reporters are anonymous to lenders | T ("filters by category and shows only the owner's first name") | #2, #23 | ✅ |
| Q-03 | Fail closed | Missing secrets: HTTP endpoints return 500 and delivery refuses to send; oversized bodies rejected before verifying | T ("fails closed without a configured secret", "rejects oversized bodies") | #5, #6 | ✅ |
| Q-04 | Input validation | Every argument has a Convex validator; text trimmed, length-limited, control characters stripped; date rules | T (`tools.test.ts`, `loans.test.ts`) | #2, #3 | ✅ |
| Q-05 | Business rules live in Convex | One state machine (`convex/lib/loans.ts`, `transitionLoan`); the UI renders server-computed action flags | T (`loans.test.ts`: state machine) | #3 | ✅ |
| Q-06 | Mutations never wait on n8n | Outbox and workpool; a loan mutation succeeds while n8n is down | T ("the loan mutation succeeds even when n8n is down") | #5 | ✅ |
| Q-07 | Works on self-hosted n8n 1.x as well as n8n Cloud | Code nodes avoid n8n 2-only globals; settings fall back to environment variables | T (settings fallback suite), L (self-hosted 1.123 and Cloud 2.45) | #9 | ✅ |
| Q-08 | End-to-end tests | Playwright with `@clerk/testing`: the full lending, reporting and admin flow | E, L (CI run) | #25 | ⚠️ Manual runs only: staging is also the live demo's backend |
| Q-09 | Documentation | README (with a requirements checklist), `n8n/README.md`, `CLAUDE.md`, this matrix | M | #8, #37 | ✅ |

## 4. Known limitations

| Item | Effect | What would close it |
|---|---|---|
| One Convex deployment serves both the live demo and end-to-end staging | The CI end-to-end job runs on demand rather than on every push | A dedicated staging deployment and Clerk instance |
| Clerk runs in development mode | Sign-in shows a "Development mode" label; the demo admin uses Clerk's test-email code | A production Clerk instance with the same session claim |
| n8n runs on an n8n Cloud trial, with successful executions saved while the demo is under review | If the trial lapses, emails and reminders stop (failures are alerted); execution history holds email addresses | Paid n8n Cloud or self-hosting; turn off saving successful executions in production (the exported JSON already has it off) |
| Availability is not a server-side filter | Admins can't page through only available or on-loan tools | Store availability, maintained on every loan change |
