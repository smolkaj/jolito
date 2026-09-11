begin;
select plan(9);
select ok(not (select prosecdef from pg_proc where oid = 'public.read_deck_snapshot()'::regprocedure), 'Snapshot reads remain security-invoker');
select ok(not has_function_privilege('anon', 'public.read_deck_snapshot()', 'execute'), 'Anonymous callers cannot read snapshots');
select ok(not has_table_privilege('authenticated', 'public.decks', 'insert,update,delete'), 'Update guidance never restores unsafe writes');
select ok(exists (
  select 1 from pg_db_role_setting, unnest(setconfig) setting
  where setrole = (select oid from pg_roles where rolname = 'authenticator')
    and setting = 'pgrst.db_pre_request=public.check_deck_client'
), 'Version-controlled hook is configured for PostgREST');

insert into auth.users (id,email) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','upgrade-a@example.com'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','upgrade-b@example.com');
insert into public.decks (user_id,device_id,data) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','a','{}'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','b','{}');
set local role authenticated;
set local "request.jwt.claims" = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';
select results_eq('select user_id from public.read_deck_snapshot()', $$values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid)$$, 'Read RPC sees only the authenticated owner');
set local "request.jwt.claims" = '{"role":"authenticated","sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
select results_eq('select user_id from public.read_deck_snapshot()', $$values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid)$$, 'A changed token reads only the new owner');
set local "request.path" = '/decks';
select throws_ok('select public.check_deck_client()', 'PT409', null, 'Obsolete reads and writes are rejected before payload handling');
set local "request.path" = '/rpc/read_deck_snapshot';
select lives_ok('select public.check_deck_client()', 'The explicit snapshot protocol is admitted');
set local "request.path" = '/feedback';
select lives_ok('select public.check_deck_client()', 'Other application routes are untouched');
select * from finish();
rollback;
