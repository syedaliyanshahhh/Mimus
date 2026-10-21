# Feature vs. Terms, Privacy Policy and DPA: gap audit

> **Internal note, not a public page.** Audit date: 2026-10-21, against the code on `docs/legal-pages-google-verification` (commit `3536c77`). The Privacy Policy, Terms and DPA are meant to describe Mimus **as built today** (see [pending-design-changes.md](pending-design-changes.md)), because Google's OAuth verification and the CASA assessment check them against the live app. This note lists where they don't match. Each item names the fix: change the **policy**, change the **code**, or **verify** an external fact. Close items in the PR that fixes them.

Priorities:

- **P0:** the policy says something false today. Fix before submitting to Google.
- **P1:** a user right or control the policy promises doesn't work.
- **P2:** processing or security behaviour that isn't disclosed or undercuts a stated safeguard.
- **P3:** consistency and housekeeping.

## Status (2026-10-22, branch `feature/policy-gap-fixes`)

| Item                                   | Status                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 Standing production access          | **Ops, in progress.** `mimus-dev` Supabase project with synthetic `seed.sql`; production secret key rotation and removing it from developer machines tracked in the PR. |
| #2 Disconnect revocation               | **Fixed in code + policy.** Gmail watch stopped, Graph and Calendly subscriptions deleted, row hard-deleted; policy explains Microsoft and Slack limits.                |
| #3 Slack/scheduling data to OpenAI     | **Policy corrected** (Privacy §3, DPA §9).                                                                                                                              |
| #4 Owners widening Private             | **Policy corrected** to match the database, proven by pgTAP as the Owner's session.                                                                                     |
| #5 Team/Company reach                  | **Fixed in code** (Owner-only "Reports to", migration 0021) **+ policy** (no sharing-list UI yet).                                                                      |
| #6 AI usage log page                   | **Fixed in code.**                                                                                                                                                      |
| #7 Sign-in email sender                | **Verified + policy corrected:** production Supabase Auth has no custom SMTP, so Supabase sends sign-in emails; invites require a verified Resend sender in production. |
| #8 Cancel subscription                 | **Fixed in code** (Stripe customer portal).                                                                                                                             |
| #9 Read-only blocks Disconnect/Private | **Fixed in code.**                                                                                                                                                      |
| #10 Removed members                    | **Fixed in code** (purge on removal; migration 0022 gives removed users a workspace).                                                                                   |
| #11 Data export                        | **Open.** Requests by email, as the policy says.                                                                                                                        |
| #12 Ownership transfer                 | **Open.** Contact us, as the policy says.                                                                                                                               |
| #13 Terms acceptance/notices           | **Fixed in code** (clickwrap, migration 0023); email notices still manual.                                                                                              |
| #14 Age check                          | **Fixed** (18+, attested in the clickwrap).                                                                                                                             |
| P2 processing items                    | **Fixed in code** (Gmail filters, Outlook deletions, row deletion, agent logs) **or policy corrected** (cookies, Stripe customer, 2-year calendar).                     |
| P2 security items                      | **Fixed in code** (invite email binding and no Owner invites, open redirect, billing RLS migration 0024, visibility errors).                                            |
| P3 billing items                       | **Policy corrected** (Terms §8). Unlabelled Canopy/Ground mock data still open.                                                                                         |
| P3 housekeeping                        | **DPA footer link fixed.** Business-fact `[TODO]`s still open.                                                                                                          |

## P0: policy states something false today

### 1. No standing production access (not true yet)

- **Policy says:** Staff have no standing access to production; dev and test use synthetic data only (Privacy §3, §7; DPA §6).
- **Code does:** Production runs on the `mimus-staging` Supabase project, and developer machines hold its `SUPABASE_SECRET_KEY` (pending-design-changes.md).
- **Fix:** **Ops:** give dev its own Supabase project or the local stack, seeded from `supabase/seed.sql` (synthetic). Rotate the production secret key and remove it from developer machines.

### 2. Disconnect doesn't revoke every service

- **Policy says:** Disconnecting a service, or deleting your account, revokes Mimus's access to every service (Privacy §9 step 1; DPA §8; Terms §13).
- **Code does:** Microsoft: no revoke; the refresh token stays valid at Microsoft (`src/server/connectors/microsoft/disconnect.ts:3-13`). Slack: the bot token is deleted locally but never revoked (`src/server/connectors/slack/installations.ts:64-80`). Provider subscriptions survive disconnect: `stopGmailWatch` (`src/server/connectors/google/webhook.ts:193`) is never called, and Graph subscriptions and Calendly webhook subscriptions are never deleted.
- **Fix:** **Code:** stop the Gmail watch and delete Graph and Calendly subscriptions on disconnect. **Policy:** say that Microsoft offers no per-app revoke and point users to their Microsoft account's app permissions page; say that the Slack app stays installed in the Slack workspace until a Slack admin removes it.

### 3. Slack and scheduling data sent to OpenAI aren't disclosed

- **Policy says:** OpenAI receives the question plus up to 1,500 characters of each email and 500 of each event description (Privacy §3, §5; DPA §9).
- **Code does:** `slackSearch` also sends up to 1,000 characters of each Slack message (`src/server/agent/tools/slackSearch.ts:28`). `createSchedulingProposal` and `proposeMeetingTimes` send free slots and the draft reply.
- **Fix:** **Policy:** add Slack excerpts and scheduling data to Privacy §3 and §5 and DPA §9.

### 4. Owners can't widen a Private account

- **Policy says:** Owners can change the visibility of **any** connected account, including a Private one, without the member's approval (Privacy §3; Terms §4; DPA §3; google-verification-checklist.md).
- **Code does:** `can_see_connected_account` (`supabase/migrations/0005_connected_accounts.sql:48-104`) never lets an Owner see a Private account, so the Owner's update can't reach it, and the Connections page doesn't list it. An Owner can widen only accounts that are already Team or Company.
- **Fix:** **Decide.** Recommended: keep the safer behaviour and correct the four documents. The alternative is a `SECURITY DEFINER` RPC that lets Owners widen any account, with a pgTAP test. Before either, prove the current behaviour with a pgTAP test run as the `owner` role (the existing Private-to-Team test in `supabase/tests/connected_accounts_rls.sql` runs as superuser).

### 5. Team and Company visibility reach fewer people than stated

- **Policy says:** Team visibility reaches your manager and teammates who report to the same manager (Privacy §3). Company visibility reaches Owners plus people on the account's sharing list.
- **Code does:** Nothing in the app sets `workspace_members.manager_id` (only `supabase/seed.sql` does), so in practice Team reaches Owners only. The Company sharing list (`connected_account_shares`) has no UI.
- **Fix:** **Code:** add manager assignment to the Members page and a sharing-list UI. Otherwise, **policy:** describe what Team and Company reach today.

### 6. AI usage log page doesn't exist

- **Policy says:** Workspace Owners can see the AI usage log (Privacy §2).
- **Code does:** `/audit-log` is a "Coming soon" placeholder (`app/(app)/audit-log/page.tsx:35-38`). The table and its Owner-only RLS already exist (`supabase/migrations/0008_agent_logs.sql`).
- **Fix:** **Code:** build the page. Otherwise remove the sentence.

### 7. Sign-in emails may not go through Resend

- **Policy says:** Resend delivers sign-in emails (Privacy §5; DPA §9).
- **Code does:** Magic links are sent by Supabase Auth (`signInWithOtp`, `app/(auth)/sign-in/sign-in-form.tsx:27-30`). `supabase/config.toml` sets no custom SMTP. Invitations use Resend's sandbox sender `onboarding@resend.dev` when `RESEND_FROM_EMAIL` is unset (`src/server/email/sendInviteEmail.ts:22`).
- **Fix:** **Verify** the production Supabase Auth SMTP setting. If it isn't Resend, list Supabase as the sign-in email sender. Set `RESEND_FROM_EMAIL` to a verified domain.

## P1: promised rights and controls that don't work

### 8. No way to cancel a subscription

- **Policy says:** You can cancel at any time (Terms §8). Account deletion tells users to "cancel it on the Billing page first".
- **Code does:** No cancel button, no Stripe Customer Portal and no refund handling. The Billing page only has Subscribe.
- **Fix:** **Code:** add a Stripe Customer Portal link for Owners.

### 9. Read-only billing blocks Disconnect and Private

- **Policy says:** You can always disconnect a service and always set your own account back to Private (Privacy §3, §8).
- **Code does:** When billing is `past_due` or `canceled`, `assertWorkspaceWritable` blocks both Disconnect and visibility changes (`app/(app)/settings/connections/actions.ts:22,33`).
- **Fix:** **Code:** exempt Disconnect and changes to Private from the read-only check.

### 10. Removed members can't clean up their data

- **Policy says:** A removed member's connected services stay connected "until you delete your account" (Privacy §6, with a TODO).
- **Code does:** A removed member keeps a `removed` membership, so `create_default_workspace_for_user` gives them no new workspace (`supabase/migrations/0002_workspace_signup.sql:14-21`). They likely can't reach Settings to disconnect or delete, and their imported data stays.
- **Fix:** **Verify** with an e2e test. Then **code:** disconnect and purge a member's accounts on removal (closing the Privacy §6 TODO), or let users without an active membership reach Settings → Account.

### 11. No data export

- **Policy says:** You can access and receive a copy of your data (data portability) (Privacy §8).
- **Code does:** No export feature.
- **Fix:** **Policy:** already says requests go by email. That's acceptable, but needs an operator runbook. **Code:** add an export later.

### 12. No ownership transfer

- **Policy says:** Contact us to transfer ownership (Privacy §9; `src/server/account/deleteAccount.ts:75`).
- **Code does:** No ownership-transfer path, even for an operator.
- **Fix:** **Code:** let an Owner promote another member to Owner, or write an operator runbook.

### 13. Terms acceptance isn't recorded; no change notices

- **Policy says:** Material changes are notified by email or in the app, 30 days ahead (Privacy §12; Terms §15). Subprocessor changes get 30 days' notice (DPA §9).
- **Code does:** Terms acceptance is a passive line on the sign-in page (`app/(auth)/sign-in/page.tsx:22-31`), with nothing on the invite page. Nothing records who accepted which version, and there's no way to send policy notices.
- **Fix:** **Code:** add a `terms_acceptances` table (user, version, time) and a clickwrap on first sign-in and on invite acceptance. Add notice email through Resend.

### 14. No age check

- **Policy says:** Minimum age (Terms §2; Privacy §11), still a TODO.
- **Code does:** No age check or attestation.
- **Fix:** **Policy:** set the age. **Code:** add an age attestation to the clickwrap in #13.

## P2: processing that isn't disclosed or is under-described

- **Gmail live sync skips the filters.** Live sync calls `history.list` with no label filter and imports every added message (`src/server/connectors/google/webhook.ts:99-114`). Spam, Promotions and Social mail can arrive after the first 90-day import excluded them. **Code:** apply the same exclusions. Otherwise reword Privacy §2.
- **Outlook deletions don't reach Mimus.** The Microsoft delta sync skips `@removed` items instead of deleting them (`src/server/connectors/microsoft/webhook.ts:102`), so mail or events a user deleted in Outlook stay in Mimus. **Code:** delete them locally.
- **Disconnect keeps the `connected_accounts` row.** The row keeps the account email, scopes and Slack team name, with status `disconnected`. **Code:** hard-delete it. Otherwise **policy:** disclose it.
- **Account deletion leaves the Stripe customer.** The customer record, holding the company name, stays at Stripe. **Policy:** cover it under "Billing records" (Privacy §6).
- **Microsoft calendar import reaches 2 years ahead** (`src/server/connectors/microsoft/backfill.ts:15`). That's consistent with "from the last 90 days onward", but worth stating.
- **Undisclosed browser storage.** The policy doesn't mention the `mimus-post-auth-redirect` cookie (set from client JS, not httpOnly, 10 minutes, holds the post-sign-in path) or `localStorage` `mimus-theme`. **Policy:** add both to the cookies line in Privacy §2.
- **Server errors may reach hosting logs.** They go to `console` (`app/api/agent/ask/route.ts:68`, `src/server/agent/tools/index.ts:56`), so error details can end up in Vercel's logs. **Verify** that no message content gets logged, and keep the "service logs" wording in Privacy §2 accurate.

## P2: security defects that undercut Privacy §7 and DPA §7

- **Invites aren't bound to an email.** `acceptInvite` (`src/server/invites/acceptInvite.ts`) doesn't check that the signed-in user's email matches the invited one, so anyone with the link can join. The `inviteMember` server action accepts any role (`app/(app)/members/actions.ts:10`), so an Owner can create an `owner` invite by calling it directly, even though the form only offers Manager and Member.
- **Open redirect.** `app/auth/callback/route.ts:13,30` passes `next` (from the query string or a cookie) to `redirect()` without checking that it's a same-site path.
- **Owners can bypass billing.** An Owner can write their workspace's `workspace_subscriptions` row directly (`supabase/migrations/0007_plans_feature_switches.sql:41-44`), for example setting `status = 'active'`.
- **Visibility errors are swallowed.** The visibility dropdown offers Team and Company to Members (`app/(app)/settings/connections/visibility-select.tsx:23-25`). RLS rejects the change, and the client discards the error silently.

## P3: billing and Terms consistency

- **No plans are seeded,** so "prices and plan limits are shown at checkout" (Terms §8) has nothing behind it yet.
- **`plans.seat_limit` is never enforced.**
- **Owners can override plan-gated feature switches** (`app/(app)/feature-switches/actions.ts:9-21`).
- **Changing plan double-bills.** It starts a new Stripe subscription rather than updating the existing one, and the old one may keep billing (`src/server/billing/createCheckoutSession.ts`, `src/server/billing/handleStripeWebhookEvent.ts:41-51`).
- **No grace period on failed payment.** A failed payment makes the workspace read-only immediately. That matches Terms §8 but leaves no grace period, and unknown Stripe statuses (`incomplete`, `paused`) are treated as `past_due`.
- **Free use is unlimited.** A workspace with no subscription row is never read-only, and with no plan there's no AI spend cap.
- **Canopy and Ground show unlabelled mock data.** Sky's mock data is labelled "Sample data", but Canopy and Ground show mock data from `src/mock/` with no label, to every user. Google's reviewers would see invented records.

## P3: housekeeping

- **No DPA link in the footer.** It links Privacy, Terms and account deletion only (`components/site-footer.tsx:4-8`).
- **Open `[TODO]`s:**
  - **All three documents:** effective dates and postal address.
  - **Privacy Policy:** Vercel and Supabase log retention, OpenAI Zero Data Retention, billing-record and backup retention, EU/UK representative, minimum age, CASA.
  - **Terms:** pricing link, refunds, free trial, price-change notice, liability cap, county, arbitration.
  - **DPA:** breach-notice hours, subprocessor notice period, SCC module and annexes.

## Checked and consistent

- **OAuth scopes match the policy.** For Google, Microsoft, Slack and Calendly, the code requests exactly the scopes the policy lists. Send and booking scopes are requested only through "Allow sending and booking" (`src/server/connectors/writeScopes.ts`).
- **Slack:** no `im:*` or `mpim:*` scopes, and DM events are filtered out (`src/server/connectors/slack/events.ts`).
- **Calendly content access is read-only.** The only write creates Mimus's own webhook subscription.
- **Attachments:** files are never downloaded.
- **Approval levels 1 to 4** behave as Privacy §2 and Terms §7 describe. Scheduling replies come from a fixed template, go only to the original sender, and each decision is applied once (`claim_scheduling_proposal`).
- **`draftEmail` never sends.**
- **OpenAI requests use `store: false`,** and questions and answers aren't saved. The `agent_logs` columns match Privacy §2, and account deletion nulls `user_id` as Privacy §6 says (`supabase/migrations/0018_account_deletion.sql`).
- **Tokens are encrypted with AES-256-GCM** (`src/server/crypto/tokenVault.ts`) and kept in `connected_account_secrets`. That table has no RLS policies, so only the service role can read it.
- **No analytics, advertising or tracking scripts.** Fonts are self-hosted through `next/font`.
- **Account deletion** follows the steps and blockers in Privacy §9.
- **Disconnect deletes** imported messages, events, people and tokens, and proposals go with them by cascade.
