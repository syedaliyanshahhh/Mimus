-- Synthetic seed for local development (`supabase db reset` runs this after
-- migrations). Everything here is invented: every person, company and
-- address uses the reserved example.com / example.org / example.net domains
-- (RFC 2606), and no row is copied from production. Never load real
-- customer data into a dev database -- see legal/privacy-policy.md.
--
-- Seeded users can sign in with a magic link (it lands in Mailpit at
-- http://127.0.0.1:54324) or with the shared dev password below. Since each
-- already has a membership, provisionAfterSignIn won't create a second
-- workspace for them.
--
--   Acme Demo Co (workspace 1)
--     olivia.owner@example.com    owner
--     max.manager@example.com     manager
--     mia.member@example.com      member   (reports to Max)
--     sam.sample@example.com      member   (reports to Max)
--   Globex Sandbox (workspace 2)
--     gabe.globex@example.net     owner
--
-- Dev-only password for every seeded user: mimus-dev-password

-- ---------------------------------------------------------------------------
-- Auth users. Token columns are '' rather than NULL because GoTrue fails to
-- scan NULLs there.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('mimus-dev-password', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'olivia.owner@example.com', 'Olivia Owner'),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'max.manager@example.com', 'Max Manager'),
  ('11111111-1111-4111-8111-000000000003'::uuid, 'mia.member@example.com', 'Mia Member'),
  ('11111111-1111-4111-8111-000000000004'::uuid, 'sam.sample@example.com', 'Sam Sample'),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'gabe.globex@example.net', 'Gabe Globex')
) as u (id, email, full_name);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.id::text like '11111111-1111-4111-8111-%';

insert into public.profiles (id, email, full_name)
select id, email, raw_user_meta_data ->> 'full_name'
from auth.users
where id::text like '11111111-1111-4111-8111-%';

-- ---------------------------------------------------------------------------
-- Companies, workspaces, memberships
-- ---------------------------------------------------------------------------
insert into public.companies (id, name) values
  ('22222222-2222-4222-8222-000000000001', 'Acme Demo Co'),
  ('22222222-2222-4222-8222-000000000002', 'Globex Sandbox');

insert into public.workspaces (id, company_id, name) values
  ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-000000000001', 'Acme Demo Co'),
  ('33333333-3333-4333-8333-000000000002', '22222222-2222-4222-8222-000000000002', 'Globex Sandbox');

-- Owner and manager first: the manager_id trigger needs the referenced row
-- to exist already.
insert into public.workspace_members (id, workspace_id, user_id, role, manager_id) values
  ('44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000001', 'owner', null),
  ('44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000002', 'manager', null),
  ('44444444-4444-4444-8444-000000000005', '33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-000000000005', 'owner', null);

insert into public.workspace_members (id, workspace_id, user_id, role, manager_id) values
  ('44444444-4444-4444-8444-000000000003', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000003', 'member', '44444444-4444-4444-8444-000000000002'),
  ('44444444-4444-4444-8444-000000000004', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000004', 'member', '44444444-4444-4444-8444-000000000002');

insert into public.invites (workspace_id, email, role, invited_by, token, expires_at) values
  ('33333333-3333-4333-8333-000000000001', 'new.hire@example.com', 'member',
   '44444444-4444-4444-8444-000000000001', 'dev-invite-token-acme-new-hire', now() + interval '7 days');

-- ---------------------------------------------------------------------------
-- Connected accounts. No connected_account_secrets rows: there are no real
-- OAuth tokens here, so any live sync against these accounts will fail by
-- design. Marked as already backfilled so nothing tries to resume one.
-- ---------------------------------------------------------------------------
insert into public.connected_accounts (
  id, workspace_id, owner_user_id, provider, account_type, visibility,
  external_account_id, scopes, status, backfill_completed_at, last_synced_at, provider_team_id
) values
  -- Olivia's Gmail, Company visibility, shared with Max
  ('55555555-5555-4555-8555-000000000001', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000001',
   'google', 'email', 'company', 'olivia.owner@example.com', array['https://www.googleapis.com/auth/gmail.readonly'],
   'connected', now() - interval '6 days', now() - interval '5 minutes', null),
  -- Olivia's Google Calendar, Private
  ('55555555-5555-4555-8555-000000000002', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000001',
   'google', 'calendar', 'private', 'olivia.owner@example.com', array['https://www.googleapis.com/auth/calendar.readonly'],
   'connected', now() - interval '6 days', now() - interval '5 minutes', null),
  -- Mia's Outlook mail, Team visibility (Max and Sam can see it)
  ('55555555-5555-4555-8555-000000000003', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000003',
   'microsoft', 'email', 'team', 'mia.member@example.com', array['Mail.Read', 'offline_access'],
   'connected', now() - interval '3 days', now() - interval '20 minutes', null),
  -- Max's Slack, Private
  ('55555555-5555-4555-8555-000000000004', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000002',
   'slack', 'slack', 'private', 'U0DEVMAX01', array['channels:history', 'channels:read'],
   'connected', now() - interval '2 days', now() - interval '1 hour', 'T0DEVACME1'),
  -- Sam's Calendly, needs re-auth
  ('55555555-5555-4555-8555-000000000005', '33333333-3333-4333-8333-000000000001', '11111111-1111-4111-8111-000000000004',
   'calendly', 'scheduling', 'private', 'https://api.calendly.example.com/users/DEVSAM', array['default'],
   'needs_reauth', now() - interval '10 days', now() - interval '2 days', null),
  -- Gabe's Gmail in the second workspace (must stay invisible to Acme)
  ('55555555-5555-4555-8555-000000000006', '33333333-3333-4333-8333-000000000002', '11111111-1111-4111-8111-000000000005',
   'google', 'email', 'private', 'gabe.globex@example.net', array['https://www.googleapis.com/auth/gmail.readonly'],
   'connected', now() - interval '1 day', now() - interval '10 minutes', null);

insert into public.connected_account_shares (connected_account_id, shared_with_user_id) values
  ('55555555-5555-4555-8555-000000000001', '11111111-1111-4111-8111-000000000002');

-- ---------------------------------------------------------------------------
-- External people discovered through those accounts
-- ---------------------------------------------------------------------------
insert into public.people (id, workspace_id, connected_account_id, email, display_name) values
  ('66666666-6666-4666-8666-000000000001', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000001', 'priya.prospect@example.org', 'Priya Prospect'),
  ('66666666-6666-4666-8666-000000000002', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000001', 'victor.vendor@example.org', 'Victor Vendor'),
  ('66666666-6666-4666-8666-000000000003', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000001', 'olivia.owner@example.com', 'Olivia Owner'),
  ('66666666-6666-4666-8666-000000000004', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000002', 'priya.prospect@example.org', 'Priya Prospect'),
  ('66666666-6666-4666-8666-000000000005', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000003', 'carl.customer@example.org', 'Carl Customer'),
  ('66666666-6666-4666-8666-000000000006', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000003', 'mia.member@example.com', 'Mia Member'),
  ('66666666-6666-4666-8666-000000000007', '33333333-3333-4333-8333-000000000002', '55555555-5555-4555-8555-000000000006', 'nina.newsletter@example.org', 'Nina Newsletter');

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
insert into public.messages (
  id, workspace_id, connected_account_id, provider_message_id, thread_id,
  subject, snippet, body_text, direction, sent_at, from_person_id
) values
  ('77777777-7777-4777-8777-000000000001', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000001',
   'dev-gmail-msg-001', 'dev-gmail-thread-001', 'Intro call next week?',
   'Hi Olivia, could we find 30 minutes next week to talk about the pilot?',
   E'Hi Olivia,\n\nCould we find 30 minutes next week to talk about the pilot? Tuesday or Wednesday afternoon works for me.\n\nThanks,\nPriya',
   'inbound', now() - interval '2 hours', '66666666-6666-4666-8666-000000000001'),
  ('77777777-7777-4777-8777-000000000002', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000001',
   'dev-gmail-msg-002', 'dev-gmail-thread-002', 'Invoice #DEV-1042',
   'Attached is the invoice for last month''s widgets.',
   E'Hello,\n\nAttached is the invoice for last month''s widgets. Payment is due in 30 days.\n\nVictor',
   'inbound', now() - interval '1 day', '66666666-6666-4666-8666-000000000002'),
  ('77777777-7777-4777-8777-000000000003', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000001',
   'dev-gmail-msg-003', 'dev-gmail-thread-002', 'Re: Invoice #DEV-1042',
   'Thanks Victor, forwarding to accounts.',
   E'Thanks Victor, forwarding to accounts.\n\nOlivia',
   'outbound', now() - interval '20 hours', '66666666-6666-4666-8666-000000000003'),
  ('77777777-7777-4777-8777-000000000004', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000003',
   'dev-graph-msg-001', 'dev-graph-conv-001', 'Renewal question',
   'Hi Mia, does our plan renew automatically in December?',
   E'Hi Mia,\n\nDoes our plan renew automatically in December, or do we need to sign something?\n\nCarl',
   'inbound', now() - interval '5 hours', '66666666-6666-4666-8666-000000000005'),
  ('77777777-7777-4777-8777-000000000005', '33333333-3333-4333-8333-000000000002', '55555555-5555-4555-8555-000000000006',
   'dev-gmail-msg-101', 'dev-gmail-thread-101', 'Your weekly digest',
   'Five things that happened this week in the sandbox.',
   E'Five things that happened this week in the sandbox.\n\n1. Nothing real.',
   'inbound', now() - interval '3 days', '66666666-6666-4666-8666-000000000007');

insert into public.message_participants (message_id, person_id, role) values
  ('77777777-7777-4777-8777-000000000001', '66666666-6666-4666-8666-000000000003', 'to'),
  ('77777777-7777-4777-8777-000000000002', '66666666-6666-4666-8666-000000000003', 'to'),
  ('77777777-7777-4777-8777-000000000003', '66666666-6666-4666-8666-000000000002', 'to'),
  ('77777777-7777-4777-8777-000000000004', '66666666-6666-4666-8666-000000000006', 'to');

-- ---------------------------------------------------------------------------
-- Calendar events
-- ---------------------------------------------------------------------------
insert into public.events (
  id, workspace_id, connected_account_id, provider_event_id, calendar_id,
  title, description, location, starts_at, ends_at, status, organizer_person_id
) values
  ('88888888-8888-4888-8888-000000000001', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000002',
   'dev-gcal-evt-001', 'primary', 'Weekly team sync', 'Standing team meeting.', 'Room 1 (fictional)',
   date_trunc('day', now()) + interval '1 day 15 hours', date_trunc('day', now()) + interval '1 day 15 hours 30 minutes',
   'confirmed', null),
  ('88888888-8888-4888-8888-000000000002', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000002',
   'dev-gcal-evt-002', 'primary', 'Pilot kickoff with Priya', 'Kickoff for the demo pilot.', 'https://meet.example.com/dev-kickoff',
   date_trunc('day', now()) + interval '3 days 17 hours', date_trunc('day', now()) + interval '3 days 17 hours 45 minutes',
   'confirmed', '66666666-6666-4666-8666-000000000004'),
  ('88888888-8888-4888-8888-000000000003', '33333333-3333-4333-8333-000000000001', '55555555-5555-4555-8555-000000000002',
   'dev-gcal-evt-003', 'primary', 'Focus time', null, null,
   date_trunc('day', now()) - interval '1 day' + interval '9 hours', date_trunc('day', now()) - interval '1 day' + interval '11 hours',
   'confirmed', null);

insert into public.event_attendees (event_id, person_id, response_status) values
  ('88888888-8888-4888-8888-000000000002', '66666666-6666-4666-8666-000000000004', 'accepted');

-- ---------------------------------------------------------------------------
-- Event-signal queue: one already processed, one pending
-- ---------------------------------------------------------------------------
insert into public.event_signals (workspace_id, type, payload, source_connected_account_id, created_at, processed_at) values
  ('33333333-3333-4333-8333-000000000001', 'message.received',
   '{"message_id":"77777777-7777-4777-8777-000000000002"}'::jsonb,
   '55555555-5555-4555-8555-000000000001', now() - interval '1 day', now() - interval '1 day' + interval '1 minute'),
  ('33333333-3333-4333-8333-000000000001', 'message.received',
   '{"message_id":"77777777-7777-4777-8777-000000000001"}'::jsonb,
   '55555555-5555-4555-8555-000000000001', now() - interval '2 hours', null);
