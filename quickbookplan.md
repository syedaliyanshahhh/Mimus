# QuickBooks Online integration → Sky, Canopy (Finance), Ground

## Context

Sky, Canopy and Ground are mockups built on hard-coded data in `src/mock/`. Sky already shows two finance tiles, "Cash on hand" ($412,800) and "Revenue this month" ($186,400 of a $240K target), plus an "Invoice 1042 is 14 days overdue" item in Needs you. Both tiles Swoop down to `/canopy/finance`, which shows "No pipeline data yet" because `finance: []`. There is also a `money` feature switch that defaults to off and that no code reads yet.

The goal is to connect a customer's QuickBooks Online (QBO) company and replace that finance mock data with real numbers:

- **Sky:** cash and revenue tiles, and overdue-invoice Needs you items.
- **Canopy → Finance:** receivables metrics and an invoice-aging board.
- **Ground:** a detail page for a single invoice.
- **Ask Mimus:** the AI agent can answer finance questions, under the same permission rules.

**Constraints that shape the design:**

1. **Intuit meters every data read.** Since November 2025, every QBO read, query, report and batch call counts as a "CorePlus" call under the Intuit App Partner Program. The free Builder tier allows **500,000 CorePlus calls a month across all of our customers combined**. Once that's used up, calls fail with HTTP 429 until the 1st of the next month. So the dashboard must **never call QBO while a page loads**. We sync into Postgres and render from there.
2. **Vercel Hobby only runs crons once a day.** Day-to-day freshness comes from QBO webhooks, with a daily CDC catch-up as backup.
3. **QBO access tokens last 1 hour, and refresh tokens rotate about every 24 hours.** Today nothing in the codebase refreshes tokens or marks a connection `needs_reauth`, and secrets have no expiry column. This connector has to build that.
4. **Permission rules stay in Postgres (AGENTS.md):** all new tables use RLS through `can_see_connected_account`.

---

## Part A: What we need from the client

### A1. From the Mimus owner (one-time, at the right step, never invented)

| Item                                                                               | Needed at                           | Notes                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Intuit Developer account and a **QuickBooks Online Accounting** app called "Mimus" | Step 2 (start)                      | Create it at developer.intuit.com with the company's business email.                                                                                                                                                                       |
| **Development** Client ID and Client Secret                                        | Step 2                              | These go in `.env.local` and Vercel Preview.                                                                                                                                                                                               |
| A sandbox company (QBO Plus, US or the target country)                             | Step 2                              | Free, up to 10 per app, each lasts 2 years. Intuit doesn't meter sandbox calls.                                                                                                                                                            |
| Redirect URIs registered in the Intuit app                                         | Step 2                              | `http://localhost:3000/api/connectors/quickbooks/callback` for dev. **Intuit rejects IP addresses, so use `localhost`, not `127.0.0.1`.** `https://getmimus.io/api/connectors/quickbooks/callback` for production.                         |
| **Webhook Verifier Token**, separate for sandbox and production                    | Step 4                              | Endpoint `https://getmimus.io/api/webhooks/quickbooks`. Turn on the entities listed in A3.                                                                                                                                                 |
| **Production** Client ID and Client Secret                                         | Step 9                              | Only appear after the App Assessment Questionnaire is approved.                                                                                                                                                                            |
| Production app details                                                             | Step 9                              | EULA URL, Privacy Policy URL, host domain `getmimus.io`, Launch URL (`/sky`), Disconnect URL (`/api/connectors/quickbooks/disconnected`), Connect/Reconnect URL (`/api/connectors/quickbooks/start`), up to 4 categories, hosting regions. |
| App Assessment Questionnaire answers                                               | Step 9                              | Business disclosures, why we use the data, GDPR/CCPA, a 24/7 support contact, breach history, and a security contact.                                                                                                                      |
| Partner Program tier decision                                                      | Before 300 or more active companies | Builder is free with a 500k-call cap. Silver is $300 a month for 1M calls, then $3.50 per 1,000.                                                                                                                                           |
| Product decisions                                                                  | Step 5                              | Where the monthly revenue target comes from (a Mimus setting; QBO has no target), and the default visibility for finance connections (see Open decisions).                                                                                 |

### A2. From each customer company connecting QuickBooks

- A **QuickBooks Online** subscription. Desktop is not supported.
- The person connecting must be a **Primary Admin or Company Admin** in QBO, or the firm owner on an accountant's account. Standard users can't authorize apps.
- If they run several QBO companies, they connect each one separately. Each company has its own `realmId` and becomes its own connection row.
- Optionally, a **monthly revenue target** in Mimus settings for the "% of target" bar. Classes and Locations set up in QBO make per-department or per-location breakdowns possible later.
- Their consent, which Intuit collects on its own screen and which our privacy policy must cover.

### A3. Scopes and data we pull from QuickBooks

**OAuth scopes requested:** `com.intuit.quickbooks.accounting openid email profile`

- `com.intuit.quickbooks.accounting` is **required** and is the only data scope we need. Intuit doesn't offer a read-only version, so Mimus enforces read-only by only ever calling GET or query endpoints. The privacy policy and the questionnaire must say so.
- `openid email profile` identify who connected the company, for the connection card and audit trail. Intuit doesn't meter these calls.
- **Not requested:**
  - `com.intuit.quickbooks.payment`: card and ACH processing, not needed.
  - Payroll and the GraphQL scopes: these are restricted and have shorter token hard-expiry.

**Endpoints we'll call. Every one is a metered CorePlus read unless marked:**

| Purpose                | Endpoint                                                                                                                                  | Used for                                                                                                                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company identity       | `GET /v3/company/{realmId}/companyinfo/{realmId}`                                                                                         | Company name, currency, fiscal-year start (connection card, date ranges).                                                                                                                                            |
| Entity backfill        | `GET /query?query=SELECT * FROM <Entity> STARTPOSITION n MAXRESULTS 1000`                                                                 | One-time load of **Account, Customer, Vendor, Invoice, Payment, Bill, BillPayment, Estimate, SalesReceipt, CreditMemo, Deposit, Purchase, Class, Department**. Invoices and bills are limited to the last 24 months. |
| Incremental sync       | `GET /cdc?entities=…&changedSince=`                                                                                                       | One call covers every changed entity. Look-back is at most 30 days, and each call returns at most 1,000 objects.                                                                                                     |
| Reports                | `GET /reports/ProfitAndLoss` (this month, and the last 12 months by month), `BalanceSheet`, `AgedReceivables`, `AgedPayables`, `CashFlow` | Revenue, cash, aging and trend. Stored as snapshots.                                                                                                                                                                 |
| Webhooks (not metered) | Intuit `POST`s CloudEvents to our endpoint                                                                                                | Tells us a company changed. We then run **one** CDC call for that company, never one GET per changed entity.                                                                                                         |
| OAuth (not metered)    | token, refresh, revoke, userinfo                                                                                                          | Connecting, refreshing tokens, disconnecting.                                                                                                                                                                        |

**Expected Intuit call volume per connected company:**

- Backfill: about 30–80 calls, once.
- Steady state: about 15–40 calls a day (daily reports and CDC, plus CDC runs triggered by webhooks and debounced), which comes to about 1,000 a month.
- On Builder, that's roughly **400 or more companies** before the 500k monthly cap is hit.

---

## Part B: Implementation plan

Repo rules apply throughout: one `feature/<name>` branch and PR per step, tests written first, the full check suite and green GitHub Actions CI before merging. Calendly's connector (`src/server/connectors/calendly/`) is the template to copy: one grant becomes one row, it uses plain `fetch`, and its refresh tokens rotate the same way.

### Step 1: Schema and RLS (`feature/quickbooks-schema`)

**Migration `supabase/migrations/0021_quickbooks.sql`:**

- Extend the CHECK constraints on `connected_accounts` to allow `provider = 'quickbooks'` and `account_type = 'accounting'`. Store `realmId` in the existing `provider_team_id` column and the company name in `provider_team_name`.
- Add `access_token_expires_at timestamptz` and `refresh_token_hard_expires_at timestamptz` to `connected_account_secrets`. These are general-purpose columns and fix the existing gap where token expiry isn't tracked.
- Add these tables:
  - `accounting_accounts`
  - `accounting_customers`
  - `accounting_vendors`
  - `accounting_invoices`: number, customer, txn_date, due_date, total, balance, status, currency.
  - `accounting_bills`
  - `accounting_payments`
  - `accounting_report_snapshots`: report_name, period_start, period_end, params, payload jsonb, fetched_at.
  - `accounting_cash_daily`: date and cash total. This builds the sparkline history, which QBO doesn't give us directly.
- Each table copies the pattern in `0012_messages_events_people.sql`:
  - It carries `workspace_id`, `connected_account_id`, `provider_id`, `raw jsonb` and `deleted_at`.
  - It's unique on `(connected_account_id, provider_id)`.
  - It allows **select only**, gated by `can_see_connected_account(connected_account_id, auth.uid())`. Only the service role can write.
- pgTAP `supabase/tests/accounting_rls.sql`, modelled on `messages_events_people_rls.sql`: row counts for owner, manager and member at private, team and company visibility, and a check that `authenticated` can't write.
- Add `'quickbooks'` and `'accounting'` everywhere the provider list is hard-coded:
  - `src/server/connectors/types.ts:5-6`
  - `src/server/connectors/labels.ts`
  - `src/server/connectors/cookies.ts`
  - `tests/server/agent/fixtures.ts:21-22`

### Step 2: OAuth connect and token handling (`feature/quickbooks-oauth`)

**New directory `src/server/connectors/quickbooks/`, one file per concern:**

- `oauth.ts` handles config from env (returns null when unset), `getAuthUrl`, `exchangeCode`, `refreshAccessToken` and `revokeToken`. It copies `calendly/oauth.ts`.
- `connect.ts` inserts the `connected_accounts` row (provider_team_id = realmId) and the encrypted secrets via `src/server/crypto/tokenVault.ts`.
- `tokens.ts` provides `getValidAccessToken(accountId)`:
  - It refreshes only when the token has expired or the API returns 401, as Intuit requires.
  - Refreshes are **serialized per account**, using a `SECURITY DEFINER` RPC that runs `select … for update` on the secrets row. That stops two concurrent refreshes from triggering `invalid_grant`.
  - It always saves the newly rotated refresh token.
  - On `invalid_grant` it sets `status='needs_reauth'`, which the settings page already displays.
- `client.ts` provides `qboGet(account, path)`:
  - Adds `minorversion=75` and `Accept: application/json`.
  - Logs only the `intuit_tid` header, never response bodies (Intuit's security rules).
  - On 429 it waits 60 seconds and retries, and keeps a per-realm limit under 10 requests a second.
  - Counts every successful call into `accounting_api_usage(day, calls)` so we can track the Partner Program quota.
- `OAuthCallbackParams` in `types.ts` gains `realmId`.

**Routes** (thin, as in `app/api/connectors/calendly/*`):

- `app/api/connectors/quickbooks/start/route.ts`
- `app/api/connectors/quickbooks/callback/route.ts`, which checks state and the nonce cookie, then runs `backfill` inside `after()`.
- `app/api/connectors/quickbooks/disconnected/route.ts`, the Intuit Disconnect URL. It marks the row disconnected by realmId and redirects to `/settings/connections`.

**Other wiring:**

- Register the connector in `src/server/connectors/bootstrap.ts`, including `isQuickbooksConfigured`.
- Add a QuickBooks card to `app/(app)/settings/connections/page.tsx`, next to the Calendly link.
- `.env.example` gets `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_OAUTH_REDIRECT_URI`, `QUICKBOOKS_ENVIRONMENT=sandbox|production` and `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`.

**Tests** in `tests/server/connectors/quickbooks/{oauth,connect,refreshToken,disconnect}.test.ts`:

- Mock `fetch` for `intuit.com` only, as in `calendly/refreshToken.test.ts:89-103`, and run against real local Supabase.
- Cover rotation, two concurrent refreshes (only one HTTP refresh may happen), and `invalid_grant` leading to `needs_reauth`.

### Step 3: Backfill and reports (`feature/quickbooks-sync`)

- `sync.ts`:
  - `backfill()` pages through each entity with `MAXRESULTS 1000` and stores rows with idempotent upserts, following `src/server/shared/normalize.ts`.
  - It then runs `refreshReports()` and sets `backfill_completed_at`. The existing `resumeBackfills` cron resumes interrupted backfills.
- `reports.ts`:
  - Fetches ProfitAndLoss (month to date, plus the last 12 months by month), BalanceSheet, AgedReceivables, AgedPayables and CashFlow.
  - Stores each as a snapshot and appends today's bank-account total to `accounting_cash_daily`.
- Fixture JSON for sandbox-shaped responses goes in `tests/server/connectors/quickbooks/fixtures/`.

### Step 4: Ongoing sync with webhooks and CDC (`feature/quickbooks-webhooks`)

**Webhook route** `app/api/webhooks/quickbooks/route.ts` uses `webhook.ts` and `signature.ts`:

- Verify `intuit-signature` as base64 HMAC-SHA256 of the raw body with the verifier token, copying `calendly/signature.ts`.
- Parse the **CloudEvents** array (the old format's deadline was July 31, 2026). Find each `intuitaccountid` through `provider_team_id`, the same way Slack looks up its team.
- Return 200 within 3 seconds, and do the work in `after()`.
- Debounce: set `connected_accounts.sync_cursor`-adjacent `qbo_dirty_since`, and run **one** CDC call per company per 5 minutes at most.

**`cdc.ts`:**

- Pulls `changedSince = last_synced_at`, never more than 30 days back. If the gap is longer, it falls back to a re-backfill.
- Applies upserts and soft-deletes for records with `status:"Deleted"`.

**Daily cron** `app/api/cron/quickbooks-daily/route.ts` (add it to `vercel.json`, authenticated with `cronAuth.ts`):

- For every connected QBO account: a CDC catch-up, `refreshReports()`, and an append to the cash history.
- Warns ahead of the 5-year refresh-token hard expiry.

**Tests:** signature valid/invalid, a multi-realm CloudEvents batch, idempotent replays and out-of-order events (`time` decides), CDC delete handling, and a gap over 30 days triggering a re-backfill.

### Step 5: Finance read layer and Sky (`feature/finance-sky`)

**`src/server/finance/*`** reads with the **user's own Supabase session**, so RLS applies. It returns the existing mock types from `src/mock/types.ts` so the current components render unchanged:

- `getCashOnHand()`:
  - Value: the sum of Bank-type `accounting_accounts.current_balance`.
  - Sparkline: `accounting_cash_daily`.
  - Change: compared with the same date last month.
- `getRevenueThisMonth()`: the P&L month-to-date snapshot's Total Income. The progress bar uses a new `workspace_settings.monthly_revenue_target`. If there's no target, fall back to the plain `stat` tile.
- `getFinanceNeedsYou()`: invoices where `balance > 0 and due_date < today`, plus bills due within 7 days.

**Page changes:**

- `app/(app)/sky/page.tsx` swaps the mock `cash-on-hand` and `revenue-this-month` tiles and finance Needs-you items for real data **when the user can see a QBO connection and the `money` switch is on**.
- Otherwise it keeps the sample data or shows an empty "Connect QuickBooks" tile, following MULTI_USER_PLAN A6 (`demo_data`).
- Every read stays inside the existing Suspense boundaries, because of the Cache Components build rule.

**Tests:** vitest tests for each finance function, as owner, manager and member, against real local Supabase.

### Step 6: Canopy Finance (`feature/finance-canopy`)

`/canopy/finance` gets finance-specific content in place of the deal kanban:

- **Metric tiles:** AR outstanding, Overdue AR, DSO (days sales outstanding), and AP due in 7 days.
- **Board:** an aging board (Current, 1–30, 31–60, 61–90, 90+) with one card per open invoice (customer, amount, days overdue). It reuses the `KanbanBoard` visuals with configurable columns. Each card Swoops to Ground.
- **Insight rail:** a deterministic insight, for example the largest overdue customer and the share of overdue AR they account for.

Also: gate the finance department behind the `money` switch, and wire up the unused `canopy` switch check at the same time. `src/mock/departments.ts` "Finance" status line comes from the overdue count.

### Step 7: Ground for one invoice (`feature/finance-ground`)

New route `app/(app)/ground/invoice/[invoiceId]/page.tsx`. A static segment takes priority over `[dealId]`. It maps to `GroundDetail`:

- **Header:** amount, balance and status (Paid, Open, or Overdue N days).
- **Timeline:** created, due, each payment, and changes caught by CDC or webhooks.
- **People:** the customer contact.
- **Insight lines:** customer payment history, i.e. average days to pay across past invoices.

A missing ID, or one the user can't see under RLS, returns `notFound()`.

### Step 8: Ask Mimus access (`feature/finance-agent-tool`)

- `src/server/connectors/quickbooks/tool.ts`, modelled on `slack/tool.ts`, which re-checks `canSeeConnectedAccount`.
- New agent tool `searchFinance` (invoices, customers and report snapshots) in `src/server/agent/tools/`.
- Extensions:
  - `Source.kind` gains `'accounting'` (`tools/types.ts:15`).
  - Module `sources` gain `'accounting'` (`modules/types.ts:13`).
  - `ask.ts` `sourceIds` gains `accounting`. `log_agent_request` already takes jsonb.
- Adversarial test: a member asking "what's our cash balance?" must not get data from a private QBO connection.

### Step 9: Production readiness and Intuit review (`feature/quickbooks-go-live`)

- Host `/legal/privacy` and `/legal/terms` as public pages, and update `legal/privacy-policy.md` to cover QuickBooks data: read-only use, retention, and deletion on disconnect.
- Disconnect from Mimus calls Intuit `revoke`, then purges the accounting rows and secrets, following `calendly/disconnect.ts`.
- Security headers on the connect, callback and finance pages (`Cache-Control: no-store`). Cookies are already HttpOnly and Secure.
- Add a QuickBooks row to the PLAN.md "External accounts" table. Submit the questionnaire, then switch Vercel production env vars to the production keys.

---

## Open decisions (each step has a recommended default)

1. **Default visibility of a QBO connection.** Keep `private` (the platform default), so the owner who connects sees finance data. They can raise it to Company and share it with specific people. _Recommended_, because finance data is sensitive.
2. **Revenue target.** Use a new workspace setting, entered by the owner. _Recommended._
3. **Estimates as a Sales pipeline source.** Out of scope for now. QBO Estimates could feed the Sales kanban later.

## Verification

- **Each step:** `npm run lint && npm run format && npm run typecheck && npm run test`, `supabase test db --local` (Step 1 and any RLS change), `npm run build` (Steps 5–7), and green CI on GitHub Actions.
- **End to end against the Intuit sandbox:**
  - Connect the sandbox company from `/settings/connections`. Check that a row exists with realmId, encrypted secrets and `backfill_completed_at`.
  - Check that Sky's cash and revenue tiles match the sandbox's BalanceSheet and P&L in the QBO UI.
  - Edit an invoice in the sandbox. Within about 5 minutes the webhook and CDC should update `/canopy/finance` and the invoice's Ground page.
  - Sign in as a member who can't see the connection and confirm finance tiles show empty states and Ask Mimus refuses.
  - Disconnect and confirm the revoke call happens and the rows are purged.
- **Playwright e2e** (`tests/e2e/finance.spec.ts`): the connections page shows the QuickBooks card; Sky to Canopy Finance to Ground invoice navigation works with seeded accounting rows.
- **Call budget:** after a week in sandbox, check `accounting_api_usage` averages no more than 40 calls a day per company.
