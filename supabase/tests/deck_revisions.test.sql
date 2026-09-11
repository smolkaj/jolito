begin;
select plan(18);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'revision_a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'revision_b@example.com');

select ok(not has_function_privilege('anon', 'public.compare_and_set_deck(uuid,bigint,jsonb)', 'execute'), 'Anonymous callers cannot execute snapshot writes');
select ok(not has_table_privilege('authenticated', 'public.decks', 'insert,update,delete'), 'Legacy REST writes cannot bypass revisions');

set local role authenticated;
set local "request.jwt.claim.sub" = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
set local "request.jwt.claims" = '{"role":"authenticated","sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"}';

select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0,
  '{"app":"jolito","version":4,"deviceId":"first","cards":[],"deletedCardIds":[]}'::jsonb), 1::bigint, 'First writer creates revision one');
select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 0,
  '{"app":"jolito","version":4,"deviceId":"stale","cards":[],"deletedCardIds":[]}'::jsonb), null::bigint, 'Competing first writer must reread');
select is((select device_id from public.decks), 'first', 'A failed compare-and-set leaves the committed snapshot untouched');
select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1,
  '{"app":"jolito","version":4,"deviceId":"second","cards":[],"deletedCardIds":["deleted"]}'::jsonb), 2::bigint, 'Observed revision advances exactly once');
select is(public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1,
  '{"app":"jolito","version":4,"deviceId":"stale","cards":[],"deletedCardIds":[]}'::jsonb), null::bigint, 'A stale update cannot overwrite a newer snapshot');
select is((select data->'deletedCardIds' from public.decks), '["deleted"]'::jsonb, 'Stale writes cannot resurrect deleted cards');
select throws_ok($$select public.compare_and_set_deck('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0,
  '{"app":"jolito","version":4,"deviceId":"spoof","cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '42501', null, 'A caller cannot write another account with its own token');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -1, '{}'::jsonb)$$,
  '22023', null, 'Negative revisions are rejected');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 9007199254740991, '{}'::jsonb)$$,
  '22023', null, 'Revision overflow cannot silently wrap');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":3,"deviceId":"old","cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '22023', null, 'Old clients cannot strip current mutation metadata');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":4,"deviceId":"bad","cards":{}}'::jsonb)$$,
  '22023', null, 'Malformed envelopes cannot replace a valid deck');
select is((select revision from public.decks), 2::bigint, 'Rejected operations do not advance the revision');

set local "request.jwt.claim.sub" = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
set local "request.jwt.claims" = '{"role":"authenticated","sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"}';
select is_empty($$select * from public.decks$$, 'Another account cannot read the snapshot');
select throws_ok($$select public.compare_and_set_deck('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2,
  '{"app":"jolito","version":4,"deviceId":"late-a","cards":[],"deletedCardIds":[]}'::jsonb)$$,
  '42501', null, 'An account-A operation cannot write after its token changes to B');
select is(public.compare_and_set_deck('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 0,
  '{"app":"jolito","version":4,"deviceId":"b","cards":[],"deletedCardIds":[]}'::jsonb), 1::bigint, 'The new account starts its own revision sequence');
select is((select device_id from public.decks), 'b', 'The new account sees only its own committed snapshot');
select * from finish();
rollback;
