-- Who accepted which version of the Terms of Service and Privacy Policy,
-- and when, including the minimum-age confirmation. Recorded by the
-- /accept-terms clickwrap on first sign-in and again whenever the version
-- changes, which is how material changes are notified in the app.
--
-- Users insert and read only their own rows. No update or delete policy:
-- an acceptance is a record, not a setting. Rows go with the user when
-- their account is deleted.

create table public.terms_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  terms_version text not null,
  age_confirmed boolean not null check (age_confirmed),
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version)
);

alter table public.terms_acceptances enable row level security;

create policy select_own_terms_acceptances on public.terms_acceptances
  for select using (user_id = auth.uid());

create policy insert_own_terms_acceptances on public.terms_acceptances
  for insert with check (user_id = auth.uid());
