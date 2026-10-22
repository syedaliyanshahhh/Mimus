begin;
select plan(7);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'new-user@example.com');

select results_eq(
  $$ select create_default_workspace_for_user('33333333-3333-3333-3333-333333333333', 'new-user@example.com') is not null $$,
  $$ values (true) $$,
  'creates a workspace and returns its id'
);

select is(
  (select count(*)::int from workspace_members where user_id = '33333333-3333-3333-3333-333333333333'),
  1,
  'user belongs to exactly one workspace'
);

select is(
  (select role from workspace_members where user_id = '33333333-3333-3333-3333-333333333333'),
  'owner',
  'user is the owner of that workspace'
);

select is(
  (select count(*)::int from profiles where id = '33333333-3333-3333-3333-333333333333'),
  1,
  'a profile row was created for the user'
);

-- Idempotency: calling it again for the same user must not create a second workspace.
select is(
  (select create_default_workspace_for_user('33333333-3333-3333-3333-333333333333', 'new-user@example.com')),
  (select workspace_id from workspace_members where user_id = '33333333-3333-3333-3333-333333333333'),
  'calling it again returns the existing workspace, not a new one'
);

-- A member removed from their only workspace is a signed-in user with
-- nowhere to go (not even Settings -> Account to delete themselves), so
-- signing in again gives them a fresh workspace of their own.
update workspace_members set status = 'removed'
  where user_id = '33333333-3333-3333-3333-333333333333';
select isnt(
  (select create_default_workspace_for_user('33333333-3333-3333-3333-333333333333', 'new-user@example.com')),
  (select workspace_id from workspace_members
     where user_id = '33333333-3333-3333-3333-333333333333' and status = 'removed'),
  'a removed-only user gets a new workspace, not the one they were removed from'
);
select is(
  (select count(*)::int from workspace_members
     where user_id = '33333333-3333-3333-3333-333333333333' and status = 'active' and role = 'owner'),
  1,
  'and is its active Owner'
);

select * from finish();
rollback;
