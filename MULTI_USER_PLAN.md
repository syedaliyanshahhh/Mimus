# Mimus: multi-tenant architecture for selling to many customers

## Context

Mimus will be sold as a service to many customer companies, but parts of the app still behave as if there's one user. Your decisions:

- **Tenant** = a company and its team.
- **One login can belong to several companies**, with a workspace switcher.
- **Self-serve signup** with a trial.
- **A basic operator admin console** for you.

### What's already multi-tenant (keep it)

- The schema is already tenant-shaped: `companies` → `workspaces` → `workspace_members` (many-to-many with users), with a role per membership.
- Every content table carries `workspace_id`: `connected_accounts`, `messages`, `events`, `people`, `agent_logs`, `feature_switches`, `workspace_subscriptions`.
- Row-level security (RLS) is deny-by-default, backed by `SECURITY DEFINER` functions (`get_workspace_role`, `can_see_connected_account`, `shares_workspace_with`).
- **Isolation model: one shared Postgres database, tenants separated by RLS** (the "pool" model). It's the right fit for 5–100-person customers. No per-tenant databases.

### Where it currently assumes one person (what this plan fixes)

1. **The app can't tell which company you're in.** `getCurrentWorkspaceContext()` uses an unordered `.limit(1)`, so a user in two companies gets one at random, and there's no switcher.
2. **Every sign-in auto-creates a workspace.** `app/auth/callback/route.ts` calls `create_default_workspace_for_user` on every sign-in. It names the company "<email>'s company" with no onboarding, and invitees get a stray workspace of their own (the known duplicate-workspace bug).
3. **Invites don't check who's accepting.** `acceptInvite()` (`src/server/invites/acceptInvite.ts`) never checks that the signed-in user's email matches the invite, so anyone holding the link can join. It also doesn't handle an existing membership. **This is a security issue once real customers exist.**
4. **Slack only works for one customer.** It uses one global `SLACK_BOT_TOKEN` (`src/server/connectors/slack/client.ts:getBotClient`), which belongs to a single Slack workspace. A second customer's Slack events can't be resolved.
5. **Plan limits aren't enforced.** `plans.seat_limit` and `ai_spend_cap_usd` exist but nothing checks them. There's no trial state and no tenant suspension.
6. **Everyone sees the same sample data.** Sky/Canopy/Ground render the mock data in `src/mock/*` for every tenant, so a new customer would see "Acme" sample deals.
7. **You have no operator view** across tenants.

## Target architecture

```
auth.users ──< workspace_members >── workspaces >── companies (tenant, Stripe customer, trial/suspension)
                 (role per membership)     │
                                           └── all content rows (workspace_id) — RLS-scoped
platform_admins (operator; separate from tenant roles; never reads tenant content)
slack_installations (team_id → encrypted bot token; one per customer Slack workspace)
```

**Active-workspace rule:** RLS still lets a user see every workspace they belong to. The _app_ picks one active workspace per request and **every query, including every future AI tool query, must filter by that `workspace_id` explicitly**, so data from two companies never blends in one answer. RLS remains the security backstop. The active workspace is stored in `profiles.active_workspace_id` and validated against an active membership on every read, so a tampered or stale value falls back safely.

## Phased plan (each item is a `feature/` branch → PR, tests first, per AGENTS.md)

### Phase A: Tenancy correctness (do first; no external accounts needed)

- **A1. Tenant isolation test suite.** New `supabase/tests/tenant_isolation.sql` (pgTAP). It seeds two companies with an owner, manager and member each, plus rows in every content table. Then, signed in as each role in tenant A, it asserts **0 rows of tenant B** in every table. A meta-test asserts that every `public` table has RLS enabled, so a future table can't silently ship without it.
- **A2. Onboarding instead of auto-provisioning.**
  - The auth callback stops creating workspaces.
  - New logic: has a pending invite token → accept it. Has memberships → go to the app. Has neither → `/onboarding`, where the user enters a company name and workspace name and the trial starts.
  - Add `create_company_with_owner(p_user_id, p_company_name, p_workspace_name)` as a `SECURITY DEFINER` function, revoked from `anon`/`authenticated` and called via the service client from a server action. It replaces `create_default_workspace_for_user`.
  - Profile creation moves to an `auth.users` insert trigger, so every user has a profile regardless of path.
- **A3. Secure invite acceptance.** Move the logic into a SQL function `accept_invite(p_token, p_user_id)`. It requires `lower(invite.email) = lower(auth email)`, checks status and expiry, upserts the membership (no duplicates), enforces the seat limit, and marks the invite accepted, all in one transaction.
- **A4. Active workspace + switcher.**
  - Add `profiles.active_workspace_id`.
  - `loadWorkspaceContext()` (`src/server/workspaces/getCurrentWorkspaceContext.ts`) picks the active workspace if the user's membership there is still active; otherwise their oldest active membership (`order by created_at`). It returns the user's full membership list for the switcher.
  - Add a `switchWorkspace(workspaceId)` server action that validates membership before writing.
  - Add the switcher to `app/(app)/avatar-menu.tsx`: companies listed with their workspaces, plus "Create a new company" linking to `/onboarding`.
- **A5. Seat limits.** Add a `workspace_seat_usage(p_workspace_id)` SQL helper (active members + pending invites). `create_invite` and `accept_invite` reject over-limit requests. The Members page shows "x / y seats".
- **A6. Real empty states.** Gate the mock data behind a `demo_data` feature switch, on only for demo workspaces. New tenants see empty-state cards ("Connect your email to see what needs you") until M4/M6 real data lands.

### Phase B: Commercial lifecycle (needs Stripe test keys; I'll ask you when we start)

- **B1. Trial.**
  - Add `companies.trial_ends_at`, set at onboarding (length as a placeholder in `plans`).
  - A trial is card-free; the Stripe customer and subscription are created at checkout.
  - Billing moves to the tenant level: one Stripe customer per company, with per-workspace subscription items as already modeled.
- **B2. Tenant state machine.** Status flow: `trialing → active → past_due → canceled`, plus an operator-set `suspended`.
  - Extend the existing kill switch (`isWorkspaceReadOnly` in `src/server/billing/killSwitch.ts`) to cover trial expiry and suspension.
  - Add an app-level blocked page for `suspended`.
  - Background jobs skip read-only tenants.
- **B3. Retention on cancellation.** A scheduled purge deletes a canceled company (cascade) N days after cancellation, after revoking its connector tokens through each connector's `disconnect()`.

### Phase C: Connectors that work for every customer

- **C1. Per-team Slack bot tokens.**
  - New `slack_installations` table (`team_id` primary key, encrypted bot token via `src/server/crypto/tokenVault.ts`, `installed_by_workspace_id`), with no RLS policies (service-role only, like `connected_account_secrets`).
  - The OAuth flow also requests the minimal bot scopes needed to resolve channel membership. The install stores the bot token, upserting per team.
  - `getBotClient(teamId)` looks the token up instead of reading the env var, and `events.ts` passes `body.team_id`. The `SLACK_BOT_TOKEN` env var is removed.
  - Slack app → public distribution. **External step: you do this.**
- **C2. Provider approvals for many users (external, long-lead; start early).**
  - **Google:** OAuth consent screen verification. Gmail read scopes are "restricted", which requires a CASA security assessment. Until it passes, Google caps the app at 100 test users.
  - **Microsoft:** the app already uses the multi-tenant `common` authority. It needs publisher verification, and some customers' IT admins must grant admin consent.
  - **Calendly:** public OAuth app.
- **C3. Webhook fan-out audit.** Google Pub/Sub routes notifications by `emailAddress`, and Microsoft routes by `subscriptionId`. Add tests confirming that one mailbox connected in two tenants fans out to both, and never to a tenant where the mailbox isn't connected.

### Phase D: Operator admin console

- **D1. Operator access.** New `platform_admins(user_id)` table and an `is_platform_admin()` SQL function. You're seeded via migration and set your user ID at deploy time (never invented).
- **D2. `/admin` routes** (outside the `(app)` tenant shell):
  - Tenant list: company, workspaces, member and seat counts, plan and status, trial end, connected-account counts by provider, AI spend from `agent_logs` aggregates.
  - Actions: suspend/unsuspend, extend trial.
  - The pages read through `SECURITY DEFINER` aggregate functions that return **metadata and counts only**. They never return message, event or people content.
- **D3. Admin audit trail.** New `admin_audit_log` table recording every operator action (who, what, which tenant, when).

### Phase E: Operating at scale (fold into M4–M6 as load arrives)

- **Background jobs.** The renewal cron (`app/api/cron/renew-watches`) and ingestion process accounts in batches, with per-tenant concurrency caps so one large tenant can't starve the others. They skip suspended or read-only tenants.
- **Per-tenant rate limits and AI spend caps.** Enforced in M4's router against `plans.ai_spend_cap_usd`, using the planned `agent_spend_counters` table.
- **RLS performance.** Perf plan Step 5: `(select auth.uid())` initplans, plus a composite `workspace_members(user_id, status)` index.
- **Production infrastructure.** Use the Supabase connection pooler (Supavisor) for serverless on Vercel, and separate staging and prod Supabase projects. Already planned.

## Critical files

- `app/auth/callback/route.ts`, new `app/onboarding/*`, `src/server/workspaces/*`, `src/server/invites/acceptInvite.ts`
- `app/(app)/avatar-menu.tsx`, `app/(app)/layout.tsx`, `src/server/billing/killSwitch.ts`
- `src/server/connectors/slack/{client,oauth,connect,events}.ts`
- New migrations from `0016_*` on: profile trigger, onboarding function, `accept_invite`, `active_workspace_id`, seat usage, trial/suspension columns, `slack_installations`, `platform_admins`, `admin_audit_log`
- New `supabase/tests/tenant_isolation.sql`, `app/admin/*`

## Verification

- **pgTAP:** the tenant isolation suite (A1) passes and becomes the regression gate for every later migration. Seat-limit and invite-email-mismatch cases each have a failing-then-passing test.
- **vitest** against local Supabase: onboarding creates exactly one company/workspace/owner; invite acceptance by the wrong email is rejected; `switchWorkspace` refuses a workspace the user isn't a member of; `getBotClient(teamId)` resolves per team.
- **Playwright with real magic links via Mailpit:**
  1. A new user signs up, goes through onboarding, and lands in an empty Sky.
  2. They invite a teammate, who accepts and lands in the inviter's workspace with **no** stray workspace.
  3. A user in two companies switches between them, and data shown changes accordingly.
  4. A suspended tenant sees the blocked page.
  5. A non-admin gets 404 on `/admin`.
- Full check suite + `npm run build` before each PR, and CI green before merging.

## Order and dependencies

Phase A (A1→A2→A3→A4→A5→A6) can start now. B needs Stripe test keys. C1 needs the Slack app's settings changed, and C2's approvals take weeks, so start them in parallel early. D can follow A. E lands alongside M4–M6.
