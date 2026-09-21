begin;
select plan(22);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'revision_a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'revision_b@example.com');

select policies_are('public', 'decks', array['Users can view their own deck'], 'Only the revision RPC owns writes; table policies grant reads only');

select ok(not has_function_privilege('anon', 'public.compare_and_set_deck(uuid,bigint,jsonb)', 'execute'), 'Anonymous callers cannot execute snapshot writes');
select ok(not has_table_privilege('authenticated', 'public.decks', 'insert,update,delete'), 'Legacy REST writes cannot bypass revisions');

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0,
  '{"app":"jolito","version":4,"deviceId":"first","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":[]}'::jsonb), 1::bigint, 'First writer creates revision one');
select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0,
  '{"app":"jolito","version":4,"deviceId":"stale","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":[]}'::jsonb), null::bigint, 'Competing first writer must reread');
select is((select device_id from public.decks), 'first', 'A failed compare-and-set leaves the committed snapshot untouched');
select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1,
  '{"app":"jolito","version":4,"deviceId":"second","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":["deleted"]}'::jsonb), 2::bigint, 'Observed revision advances exactly once');
select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1,
  '{"app":"jolito","version":4,"deviceId":"stale","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":[]}'::jsonb), null::bigint, 'A stale update cannot overwrite a newer snapshot');
select is((select data->'deletedCardIds' from public.decks), '["deleted"]'::jsonb, 'Stale writes cannot resurrect deleted cards');
select throws_ok($$select public.compare_and_set_deck('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0,
  '{"app":"jolito","version":4,"deviceId":"spoof","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '42501', null, 'A caller cannot write another account with its own token');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -1, '{}'::jsonb)$$,
  '22023', null, 'Negative revisions are rejected');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 9007199254740991, '{}'::jsonb)$$,
  '22023', null, 'Revision overflow cannot silently wrap');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":3,"deviceId":"old","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '22023', null, 'Old clients cannot strip current mutation metadata');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":4,"deviceId":"bad","cards":{}}'::jsonb)$$,
  '22023', null, 'Malformed envelopes cannot replace a valid deck');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":4,"deviceId":"bad","updatedAt":1789844855022,"cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '22023', null, 'Numeric timestamps are strictly rejected at RPC ingress');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":4,"deviceId":"bad","cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '22023', null, 'Missing updatedAt is strictly rejected at RPC ingress');
select is((select revision from public.decks), 2::bigint, 'Rejected operations do not advance the revision');

set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"role":"authenticated","sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
select is_empty($$select * from public.decks$$, 'Another account cannot read the snapshot');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":4,"deviceId":"late-a","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '42501', null, 'An account-A operation cannot write after its token changes to B');
select is(public.compare_and_set_deck('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0,
  '{"app":"jolito","version":4,"deviceId":"b","updatedAt":"2026-09-10T00:00:00.000Z","cards":[],"deletedCardIds":[]}'::jsonb), 1::bigint, 'The new account starts its own revision sequence');
select is((select device_id from public.decks), 'b', 'The new account sees only its own committed snapshot');

-- Direct table writes (admin/service_role) must also adhere to check_deck_payload_schema
set local role postgres;
select throws_ok(
  $$ insert into public.decks (user_id, device_id, version, data, revision)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b', 4,
             '{"app":"jolito","version":4,"deviceId":"b","updatedAt":1789844855022,"cards":[],"deletedCardIds":[]}'::jsonb, 99) $$,
  '23514', null, 'Direct writes with numeric updatedAt violate table check constraint'
);
select * from finish();
rollback;
