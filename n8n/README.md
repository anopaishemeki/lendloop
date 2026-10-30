# n8n workflows

Three workflows live in [`workflows/`](workflows). They are exported without credential IDs, instance IDs or pinned data, and `npm run check:n8n` (also run in CI) fails if a secret or credential ID ever creeps back in.

| File | Workflow | Trigger |
|---|---|---|
| `lendloop-request-notifications.json` | LendLoop - Request notifications | Webhook from Convex on every request and status change |
| `lendloop-overdue-reminders.json` | LendLoop - Overdue reminders | Schedule, daily 08:00 UTC |
| `lendloop-error-handler.json` | LendLoop - Error handler | Error Trigger, set as the error workflow of the other two |

The workflows are instance-agnostic. Moving between n8n Cloud, another Cloud workspace or a self-hosted instance changes only:
- the webhook base URL
- the "Resend API" credential
- five settings values

Everything else is in the JSON.

## What you enter by hand

### Values to set in n8n

These live in **n8n Variables** (the **Variables** page in n8n Cloud). On a self-hosted community install without Variables, use environment variables with the same names (see `n8n/.env.example` and `docker-compose.yml`). Every Code node reads a setting through the same small `setting()` helper: Variables first, then the environment. A missing setting fails the node with a message naming it.

| Name | Value | Must match |
|---|---|---|
| `LENDLOOP_CONVEX_SITE_URL` | `https://<deployment>.convex.site` (no trailing slash) | Convex dashboard → Settings → URL & Deploy Key → HTTP Actions URL |
| `LENDLOOP_OUTBOUND_SECRET` | 32+ random bytes, hex | Convex env `N8N_OUTBOUND_SECRET` |
| `LENDLOOP_INBOUND_SECRET` | 32+ random bytes, hex, different from the outbound one | Convex env `N8N_INBOUND_SECRET` |
| `RESEND_FROM` | e.g. `LendLoop <onboarding@resend.dev>` | A sender Resend accepts for your account |
| `OPS_ALERT_EMAIL` | Where failure alerts go | n/a |

Generate each secret with:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Credential

Create one credential: **Credentials → Add credential → Header Auth**.
- Name: `Resend API` (the workflows reference it by this name)
- Header name: `Authorization`
- Header value: `Bearer re_...` (your Resend API key)

When you import a workflow, open each Resend HTTP Request node and pick this credential if n8n hasn't matched it automatically.

### Production webhook URL

1. Activate **LendLoop - Request notifications**.
2. Open the **Request event** node and copy the **Production URL**. It looks like `https://<instance>.app.n8n.cloud/webhook/lendloop/request-events`. Don't use the `/webhook-test/` URL: it only works while the editor is listening.
3. Set it in Convex:

   ```
   npx convex env set N8N_REQUEST_WEBHOOK_URL https://<instance>.app.n8n.cloud/webhook/lendloop/request-events
   ```

### Error workflow

Error-workflow IDs are specific to each instance, so they can't be stored in the export. After importing all three workflows:
1. Open **Request notifications**, then **Overdue reminders**.
2. In each, go to **Settings → Error workflow** and choose **LendLoop - Error handler**.
3. Save.

## Import into n8n Cloud

1. Create the Variables and the `Resend API` credential described above.
2. Go to **Workflows → Add workflow → ⋯ → Import from File**. Import `lendloop-error-handler.json` first, then the other two.
3. In each imported workflow, check that the Resend HTTP Request nodes use the `Resend API` credential.
4. Set the error workflow on Request notifications and Overdue reminders.
5. Activate all three workflows. Copy the production webhook URL into Convex as described above.

## Run n8n locally instead (optional)

`docker-compose.yml` at the repo root runs a pinned n8n image for development:

```bash
cp n8n/.env.example n8n/.env   # set the five settings and WEBHOOK_URL
docker compose up -d           # editor at http://localhost:5678 (loopback only)
```

Points to know:
- **No Variables on community edition.** The settings come from the environment instead. To allow that, the compose file sets `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, so it deliberately doesn't set n8n's own encryption key in the environment.
- **Code nodes need `crypto`.** The compose file sets `NODE_FUNCTION_ALLOW_BUILTIN=crypto`.
- **n8n 1.x differences.** The workflows run on 1.x as well as newer releases (tested on self-hosted 1.123):
  - Code nodes lack several Node globals, including `URL`, `URLSearchParams`, `fetch` and `structuredClone`, so the Code nodes don't use them. `tests/unit/n8n-workflows.test.ts` runs each node in a sandbox with only the globals n8n provides, and `require` limited to `NODE_FUNCTION_ALLOW_BUILTIN`, so a node that relies on anything else fails its tests.
  - A full text HTTP response goes to `data` by default on 1.x, so **Fetch overdue loans** names its output field `body` explicitly.
- **Convex must reach the webhook.** Convex runs in the cloud, so tunnel only the `/webhook/` path to port 5678 and set `WEBHOOK_URL` to the tunnel URL. The reminders workflow only makes outbound calls.

Then import and configure the workflows as above.

## Node-by-node configuration

The JSON is the source of truth. This section is for building the workflows by hand in the editor, or for checking an import.

Code nodes use the default **Run Once for All Items** mode unless noted, and their JavaScript is in the export: copy it from the JSON's `jsCode` field. Settings are read only inside Code nodes. HTTP nodes take URLs and sender addresses from the previous node's output (`$json.url`, `$json.from`), so expressions never touch `$vars` or `$env`. "Retry" means the node's **Settings → Retry On Fail** is on, with **Max Tries 3** and **Wait Between Tries 2000 ms**.

### 1. LendLoop - Request notifications

Workflow settings:
- **Save successful production executions:** off, so recipient emails don't pile up in execution history.
- **Save failed executions:** on.
- **Error workflow:** LendLoop - Error handler.

**Request event** (Webhook)
- HTTP Method: POST
- Path: `lendloop/request-events`
- Respond: Using 'Respond to Webhook' Node
- Options → Raw Body: on. This is required: the signature covers the exact bytes Convex sent.

**Verify signature** (Code)
- Recomputes `HMAC-SHA256(LENDLOOP_OUTBOUND_SECRET, "<ts>.POST.<webhook path>.<raw body>")` with `require('crypto')`.
- Compares it to `X-LendLoop-Signature` with `timingSafeEqual`.
- Rejects timestamps more than 300 s old or ahead.
- Outputs only `{ valid, reason }` or `{ valid: true, payload }`. Headers and raw body go no further.

**Signature valid?** (If): `{{ $json.valid }}` is true.
- false → **Respond 401** (Respond to Webhook, JSON, response code 401, `{ "error": "invalid signature" }`).

**Build email** (Code): builds the subject and text for the event from the minimized payload. Output: `{ eventId, from, to, subject, text }`.

**Send email (Resend)** (HTTP Request)
- POST `https://api.resend.com/emails`
- Authentication: Generic Credential Type → Header Auth → `Resend API`
- Send Headers: `Idempotency-Key` = `{{ 'lendloop-' + $json.eventId }}`
- Body: JSON, `{{ JSON.stringify({ from: $json.from, to: [$json.to], subject: $json.subject, text: $json.text }) }}`
- Timeout: 10000
- Retry: on
- Settings → On Error: Continue (using error output)

Its outputs:
- success → **Respond 200** (JSON, 200, `{ "received": true }`)
- error → **Classify failure**

**Classify failure** (Code): marks an error as retryable when the status is 5xx, 408 or 429, or there is no status at all (a network failure).

**Worth retrying?** (If): `{{ $json.retryable }}` is true.
- true → **Respond 502 (Convex retries)**
- false → **Respond 422 (do not retry)**

Both of those then go to **Fail execution** (Stop and Error), so the error workflow raises an alert.

Convex retries 5xx, 408 and 429 responses (and network errors), for up to 6 attempts over about 20 minutes. Other responses are final. Resend's idempotency key means a retry after an email was actually sent doesn't send it twice.

### 2. LendLoop - Overdue reminders

Workflow settings: as above, plus **Timezone: UTC**, because reminder dates are UTC days.

**Every day at 08:00 UTC** (Schedule Trigger): Days, hour 8.

**Sign request** (Code): signs `"<ts>.GET./n8n/overdue-loans."` with `LENDLOOP_INBOUND_SECRET`. Output: `{ url, timestamp, signature }`.

**Fetch overdue loans** (HTTP Request)
- GET `{{ $json.url }}`
- Send Headers: `X-LendLoop-Timestamp` = `{{ $json.timestamp }}`, `X-LendLoop-Signature` = `{{ $json.signature }}`
- Options → Response: Include Response Headers and Status on, Response Format Text, Put Output in Field `body`
- Timeout: 15000
- Retry: **off**. Convex accepts this signature only once, to stop replays that would hand out borrower emails, so a retry would reuse a spent signature. A failed fetch fails the run and alerts ops; re-running the workflow is safe.

**Verify response** (Code)
- Convex signs its response with the method `RESPONSE`. This node checks that signature and its freshness, and throws if either is wrong, which fails the run and alerts ops.
- Outputs one item per overdue loan. When nothing is overdue the run simply ends here.

**Build reminder** (Code, Run Once for Each Item): `{ loanId, reminderDate, idempotencyKey, from, to, subject, text }`.

**Send reminder (Resend)** (HTTP Request)
- Configured like *Send email* above, with `Idempotency-Key` = `{{ 'lendloop-reminder-' + $json.idempotencyKey }}`
- On Error: Continue (using error output)
- Both outputs go to **Record outcome**.

**Record outcome** (Code, Run Once for Each Item): `{ loanId, reminderDate, status: 'sent' | 'failed', error? }`.

**Sign write-back** (Code, Run Once for Each Item): signs `"<ts>.POST./n8n/reminders.<body>"`. Output: `{ url, body, timestamp, signature }`.

**Write back to Convex** (HTTP Request)
- POST `{{ $json.url }}`
- Signature headers as above
- Body: Raw, content type `application/json`, `{{ $json.body }}`
- Retry: on

Convex stores at most one reminder per loan per day, so retries and re-runs are safe. If the run fails after the retries, the error workflow alerts ops. Re-running the workflow the same day skips loans that already got a reminder.

### 3. LendLoop - Error handler

**Error Trigger** → **Format alert** (Code; outputs `from` = `RESEND_FROM` and `to` = `OPS_ALERT_EMAIL`) → **Email ops (Resend)** (HTTP Request, retry on).

The alert contains:
- the workflow name
- the failed node
- the error message
- the execution link

It never includes payload data.

## Testing an import

1. **Signature path:** in Convex, request a tool as one user. The owner should get an email. Check `notificationOutbox` in the Convex dashboard: the row should be `sent`.
2. **Rejection path:** temporarily change `LENDLOOP_OUTBOUND_SECRET` in n8n and request again. n8n answers 401, the failed execution shows `mismatch`, and Convex marks the event `failed` without retrying. Restore the secret, then run `npx convex run notifications:redriveFailed`.
3. **Reminders:** in the Convex dashboard, create (or edit) an approved loan with an `endDate` in the past. Run **Overdue reminders** manually. The borrower gets one email and a `reminders` row appears. Run it again: no second email, no second row.
4. **Error workflow:** n8n only runs error workflows for production executions, not for manual runs from the editor. To test it:
   1. Set `LENDLOOP_CONVEX_SITE_URL` to a wrong URL.
   2. Change the schedule to every minute and activate the workflow.
   3. Wait for the next run. It fails after its retries, and `OPS_ALERT_EMAIL` receives an alert.
   4. Restore both settings.
