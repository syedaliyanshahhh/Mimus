begin;
select plan(7);

select has_table('public', 'terms_acceptances', 'terms_acceptances table exists');

insert into auth.users (id, email) values
  ('c2000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('c2000000-0000-0000-0000-00000000000b', 'bob@example.com');

-- Alice records her own acceptance.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c2000000-0000-0000-0000-00000000000a","role":"authenticated"}';
select lives_ok(
  $$ insert into terms_acceptances (user_id, terms_version, age_confirmed)
     values ('c2000000-0000-0000-0000-00000000000a', '2026-10-22', true) $$,
  'a user can record their own acceptance'
);
select throws_ok(
  $$ insert into terms_acceptances (user_id, terms_version, age_confirmed)
     values ('c2000000-0000-0000-0000-00000000000b', '2026-10-22', true) $$,
  'new row violates row-level security policy for table "terms_acceptances"',
  'a user cannot record acceptance for someone else'
);
select throws_ok(
  $$ insert into terms_acceptances (user_id, terms_version, age_confirmed)
     values ('c2000000-0000-0000-0000-00000000000a', '2026-11-01', false) $$,
  '23514',
  null,
  'acceptance without the age confirmation is rejected'
);
update terms_acceptances set terms_version = '1999-01-01'
  where user_id = 'c2000000-0000-0000-0000-00000000000a';
reset role;
select is(
  (select terms_version from terms_acceptances where user_id = 'c2000000-0000-0000-0000-00000000000a'),
  '2026-10-22',
  'an acceptance record cannot be edited afterwards'
);

-- Bob can't see Alice's record.
set local role authenticated;
set local request.jwt.claims to '{"sub":"c2000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select is(
  (select count(*)::int from terms_acceptances),
  0,
  'a user sees only their own acceptances'
);
reset role;
reset request.jwt.claims;

-- Deleting the user deletes their acceptance records.
delete from auth.users where id = 'c2000000-0000-0000-0000-00000000000a';
select is(
  (select count(*)::int from terms_acceptances where user_id = 'c2000000-0000-0000-0000-00000000000a'),
  0,
  'acceptances go with the user'
);

select * from finish();
rollback;
