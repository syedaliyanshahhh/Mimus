# Pending design changes and their legal-page impact

> **Internal note, not a public page.** The Privacy Policy, Terms, DPA and connector schedule describe Mimus **as built today**, because Google's OAuth verification and the CASA assessment check the policy against the live app. The target design below is not built yet. When each item ships, update the listed sections in the same pull request.
>
> Where the policies don't match the code as built today, see [feature-policy-gap-audit.md](feature-policy-gap-audit.md).

## Target design (from the 2026-10-19 decisions)

- **Hosting on an AWS private server, one unique client ID per client.**
  - Today: Vercel (app) and Supabase US East (database), multi-tenant, separated by workspace and row-level security.
  - Update when shipped: Privacy §5 and §10, DPA §9 subprocessor list and §13, the connector schedule header, and `legal/google-verification-checklist.md` (storage answer).
- **AI provider: Anthropic or OpenAI, client's choice, both listed as subprocessors.**
  - Today: OpenAI only (`src/server/agent/providers/openai.ts`). The Anthropic provider was replaced on 2026-10-11 (`PLAN.md`).
  - Update when shipped: Privacy §3 ("How we share it") and §4–§5, Terms §7, the DPA §9 list (add Anthropic, or AWS Bedrock if routed that way), and the connector schedule "AI processing" block (per-client choice).
- **New connectors: Google Drive, QuickBooks, other client-provided systems.**
  - Today: Gmail, Google Calendar, Outlook mail and calendar, Slack, Calendly. QuickBooks is planned in `quickbookplan.md`; Drive isn't planned yet.
  - Update when shipped: Privacy §2 and §3 (Drive is a Google API and needs its own scope justification and Limited Use text), Terms §4, the DPA §5 data types, a new connector schedule block, and a re-submission to Google for any new Google scope.
- **Data minimization: store IDs, sender, date, subject and a short snippet only; fetch full bodies at query time; no raw API payloads, HTML or attachments.**
  - Today: `messages` stores `body_text`, `body_html` and `raw`; `events` and `people` also store `raw` (`supabase/migrations/0012_messages_events_people.sql`). Attachment files aren't downloaded, but the stored `raw` record can include attachment names and metadata.
  - Update when shipped: Privacy §2 ("What we store" for email and calendar) and §3, and the connector schedule "Stored" lines.
- **QuickBooks: aggregates only, no bank identifiers.** Write this into the QuickBooks blocks when that connector ships.
- **Hard retention cap on cached content (30 to 90 days) and a defined backup expiry.**
  - Today: imported data is kept while the account stays connected; backup retention is still a TODO.
  - Update when shipped: Privacy §3 ("Storage, retention and removal") and §6, and DPA §8.
- **A separate encryption key per client; deleting a client destroys its key.**
  - Today: one app-wide `TOKEN_ENCRYPTION_KEY` (with version rotation) encrypts OAuth tokens only (`src/server/crypto/tokenVault.ts`). Message content is encrypted at rest by Supabase, not per client.
  - Update when shipped: Privacy §7 and DPA §7–§8 (crypto-shredding on deletion).
- **No production data for us: dev and staging on synthetic data and sandbox accounts; break-glass-only production access.**
  - Already written into Privacy §3 and §7 and DPA §6 as a commitment.
  - **Not true yet:** production runs on the `mimus-staging` Supabase project, and local dev was pointed at it with the secret key. Before submitting to Google, give dev its own Supabase project (or the local Docker stack) with synthetic data, and remove the production `SUPABASE_SECRET_KEY` from developer machines.

## Answers to the five engineering questions (from the code as of 2026-10-19)

1. **Pass-through vs cached content.**
   - Search currently needs cached bodies. `searchMessages` filters with `ilike` over `subject`, `snippet` and `body_text` (`src/server/agent/tools/searchMessages.ts:46`), and sends the AI up to 1,500 characters of `body_text` per match (line 68).
   - Pass-through is possible but means rewriting search. Search the provider at query time (Gmail `q=`, Graph `$search`), then fetch only the matching bodies.
   - Minimum cache if we keep one: subject, sender, date and snippet for local filtering. Drop `body_html` and `raw` outright; neither is read by search.
2. **Synthetic data and sandbox accounts.** These are setup work, not code: Google test users, an Intuit sandbox company, a dev Slack workspace, and a separate dev Supabase project or the local stack (`npx supabase start`). There's no seed file yet. The pgTAP tests in `supabase/tests/` build their own test rows and are a starting point for a synthetic seed.
3. **Per-client KMS keys.**
   - There's no AWS setup in the repo yet, so this can't be confirmed from the code.
   - The token vault already supports versioned keys. Per-client keys mean looking up a key per workspace or client instead of per version, and encrypting content columns too, not just tokens.
4. **What we log today.**
   - `agent_logs` (`supabase/migrations/0008_agent_logs.sql`) records each AI request: who, workspace, model, tokens, cost, cited sources and success. It doesn't record the question or the answer.
   - Nothing records who viewed which connected data in the UI. Logging CEO views of employee data needs a new access-log table, written whenever a viewer reads an account they don't own.
5. **Cheaper AI path to build first.** Direct OpenAI is already built and running. Anthropic through Bedrock means a new provider behind the existing `AiProvider` interface (`src/server/agent/providers/types.ts`) plus AWS credentials. The interface was designed for swapping, so the cost is moderate.
