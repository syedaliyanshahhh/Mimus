begin;
select plan(6);

-- Fixture: Owner O, Manager A, Manager E, Member B (reports to A), Member C (no manager).
insert into auth.users (id, email) values
  ('c1000000-0000-0000-0000-00000000000f', 'owner@example.com'),
  ('c1000000-0000-0000-0000-00000000000a', 'manager-a@example.com'),
  ('c1000000-0000-0000-0000-00000000000e', 'manager-e@example.com'),
  ('c1000000-0000-0000-0000-00000000000b', 'member-b@example.com'),
  ('c1000000-0000-0000-0000-00000000000c', 'member-c@example.com');

insert into companies (id, name) values ('d1000000-0000-0000-0000-000000000001', 'Co');
insert into workspaces (id, company_id, name)
  values ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'WS');

insert into workspace_members (id, workspace_id, user_id, role, manager_id) values
  ('f1000000-0000-0000-0000-00000000000f', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000f', 'owner', null),
  ('f1000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000a', 'manager', null),
  ('f1000000-0000-0000-0000-00000000000e', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000e', 'manager', null);
insert into workspace_members (id, workspace_id, user_id, role, manager_id) values
  ('f1000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000b', 'member', 'f1000000-0000-0000-0000-00000000000a'),
  ('f1000000-0000-0000-0000-00000000000c', 'e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-00000000000c', 'member', null);

-- Owner session: can assign a Manager to a Member.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select lives_ok(
  $$ update workspace_members set manager_id = 'f1000000-0000-0000-0000-00000000000e' where id = 'f1000000-0000-0000-0000-00000000000c' $$,
  'owner session: can assign a manager'
);
select throws_ok(
  $$ update workspace_members set manager_id = 'f1000000-0000-0000-0000-00000000000b' where id = 'f1000000-0000-0000-0000-00000000000c' $$,
  'manager_id must reference an active Owner or Manager',
  'owner session: cannot make a Member someone''s manager'
);
reset role;
select is(
  (select manager_id from workspace_members where id = 'f1000000-0000-0000-0000-00000000000c'),
  'f1000000-0000-0000-0000-00000000000e'::uuid,
  'the owner''s assignment was saved'
);

-- Manager session: may still manage a Member's role, but must not pull
-- them under itself -- that would widen the Manager's Team visibility.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select throws_ok(
  $$ update workspace_members set manager_id = 'f1000000-0000-0000-0000-00000000000a' where id = 'f1000000-0000-0000-0000-00000000000c' $$,
  'only workspace Owners can assign managers',
  'manager session: cannot reassign a member to themselves'
);
reset role;

-- Member session: RLS doesn't let a Member update anyone, so nothing changes.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c1000000-0000-0000-0000-00000000000b","role":"authenticated"}';
update workspace_members set manager_id = null where id = 'f1000000-0000-0000-0000-00000000000b';
reset role;
select is(
  (select manager_id from workspace_members where id = 'f1000000-0000-0000-0000-00000000000b'),
  'f1000000-0000-0000-0000-00000000000a'::uuid,
  'member session: cannot clear their own manager'
);

-- Service role (no auth.uid()) is unaffected, e.g. seeding and admin scripts.
reset request.jwt.claims;
update workspace_members set manager_id = null where id = 'f1000000-0000-0000-0000-00000000000c';
select is(
  (select manager_id from workspace_members where id = 'f1000000-0000-0000-0000-00000000000c'),
  null,
  'service role: can still change manager_id'
);

select * from finish();
rollback;
