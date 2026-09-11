begin;
select plan(13);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'delete-a@example.com'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'delete-b@example.com');
insert into public.decks (user_id, device_id, data) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'device-a', '{"cards":[]}'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'device-b', '{"cards":[]}');
insert into public.feedback (user_id, email, message) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'delete-a@example.com', 'Account A'),
  (null, 'guest@example.com', 'Guest remains');

set local role anon;
select throws_ok(
  $$ select public.delete_user_account() $$,
  '42501', null, 'Guests cannot invoke account deletion'
);
reset role;

-- Failure anywhere in the cascade must roll back the entire operation.
create function pg_temp.reject_deck_deletion() returns trigger language plpgsql as $$
begin
  raise exception 'Simulated cascade failure';
end;
$$;
create trigger reject_deck_deletion before delete on public.decks
  for each row execute function pg_temp.reject_deck_deletion();

set local role authenticated;
set local "request.jwt.claims" = '{"role":"authenticated","sub":"aaaaaaaa-0000-4000-8000-000000000001"}';
select throws_ok(
  $$ select public.delete_user_account() $$,
  'P0001', 'Simulated cascade failure', 'Failed cascade rejects deletion'
);
reset role;
select is((select count(*) from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint, 'Failure preserves account');
select is((select count(*) from public.decks where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint, 'Failure preserves deck');
select is((select count(*) from public.feedback where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 1::bigint, 'Failure preserves feedback');
drop trigger reject_deck_deletion on public.decks;

set local role authenticated;
select lives_ok($$ select public.delete_user_account() $$, 'Retry deletes account in one transaction');
reset role;
select is((select count(*) from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0::bigint, 'Success removes account');
select is((select count(*) from public.decks where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0::bigint, 'Success removes deck');
select is((select count(*) from public.feedback where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0::bigint, 'Success removes owned feedback');
select is((select count(*) from auth.users where id = 'aaaaaaaa-0000-4000-8000-000000000002'), 1::bigint, 'Other account remains');
select is((select count(*) from public.decks where user_id = 'aaaaaaaa-0000-4000-8000-000000000002'), 1::bigint, 'Other account deck remains');
select is((select count(*) from public.feedback where user_id is null and message = 'Guest remains'), 1::bigint, 'Unowned guest feedback remains');
set local role authenticated;
select lives_ok($$ select public.delete_user_account() $$, 'Retry after committed deletion is idempotent');
select * from finish();
rollback;
