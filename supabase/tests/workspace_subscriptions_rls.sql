begin;
select plan(4);

insert into auth.users (id, email) values
  ('c3000000-0000-0000-0000-00000000000f', 'owner@example.com'),
  ('c3000000-0000-0000-0000-00000000000b', 'member@example.com');
insert into companies (id, name) values ('d3000000-0000-0000-0000-000000000001', 'Co');
insert into workspaces (id, company_id, name)
  values ('e3000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', 'WS');
insert into workspace_members (workspace_id, user_id, role) values
  ('e3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000f', 'owner'),
  ('e3000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-00000000000b', 'member');
insert into workspace_subscriptions (workspace_id, status)
  values ('e3000000-0000-0000-0000-000000000001', 'past_due');

-- Only Stripe's webhook (service role) changes billing state. An Owner who
-- could write this row could mark a lapsed workspace active without paying.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c3000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select is(
  (select status from workspace_subscriptions where workspace_id = 'e3000000-0000-0000-0000-000000000001'),
  'past_due',
  'owner session: can read the workspace subscription'
);
update workspace_subscriptions set status = 'active'
  where workspace_id = 'e3000000-0000-0000-0000-000000000001';
delete from workspace_subscriptions where workspace_id = 'e3000000-0000-0000-0000-000000000001';
reset role;
select is(
  (select status from workspace_subscriptions where workspace_id = 'e3000000-0000-0000-0000-000000000001'),
  'past_due',
  'owner session: cannot change or delete the subscription'
);

set local role authenticated;
set local request.jwt.claims to '{"sub":"c3000000-0000-0000-0000-00000000000f","role":"authenticated"}';
select throws_ok(
  $$ insert into workspace_subscriptions (workspace_id, status)
     values ('e3000000-0000-0000-0000-000000000001', 'active') $$,
  'new row violates row-level security policy for table "workspace_subscriptions"',
  'owner session: cannot insert a subscription'
);

set local request.jwt.claims to '{"sub":"c3000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is(
  (select count(*)::int from workspace_subscriptions where workspace_id = 'e3000000-0000-0000-0000-000000000001'),
  1,
  'member session: can read the workspace subscription'
);
reset role;

select * from finish();
rollback;
