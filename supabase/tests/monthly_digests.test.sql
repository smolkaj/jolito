begin;
select no_plan();

-- Set up test accounts
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  ('d0000000-0000-0000-0000-000000000001', 'learner1@example.com', now(), now()),
  ('d0000000-0000-0000-0000-000000000002', 'learner2@example.com', now(), now()),
  ('d0000000-0000-0000-0000-000000000003', 'unverified@example.com', null, null);

-- Give learner1 and learner2 a valid deck
insert into public.decks (user_id, device_id, version, data, revision) values
  ('d0000000-0000-0000-0000-000000000001', 'dev-1', 4,
   '{"version": 4, "app": "jolito", "updatedAt": "2026-09-28T12:00:00.000Z", "deviceId": "dev-1", "cards": [{"id": "c1", "noteId": "c1", "prompt": "hola", "answer": "hello", "direction": "es-en", "context": "", "scene": "conversation", "schedule": {"state": "review", "intervalDays": 25, "reviews": 5, "lapses": 0, "dueAt": 0, "easeFactor": 2.5}}], "deletedCardIds": []}'::jsonb, 1),
  ('d0000000-0000-0000-0000-000000000002', 'dev-2', 4,
   '{"version": 4, "app": "jolito", "updatedAt": "2026-09-28T12:00:00.000Z", "deviceId": "dev-2", "cards": [], "deletedCardIds": []}'::jsonb, 1);

-- RLS & Security checks
set local role anon;
select throws_ok($$ select * from public.claim_monthly_digests() $$, '42501', null, 'Guests cannot claim digests');
select throws_ok($$ select * from private.monthly_digests $$, '42501', null, 'Guests cannot read private digest table');
select throws_ok($$ select public.get_digest_preference() $$, '42501', null, 'Guests cannot get digest preference');

set local role authenticated;
select throws_ok($$ select * from public.claim_monthly_digests() $$, '42501', null, 'Authenticated learners cannot claim digests');
select throws_ok($$ select public.finish_monthly_digest(gen_random_uuid(), gen_random_uuid(), true) $$, '42501', null, 'Learners cannot finish digests');
select throws_ok($$ select public.unsubscribe_monthly_digest(gen_random_uuid()) $$, '42501', null, 'Learners cannot directly invoke admin unsubscribe RPC');

-- Check learner digest preference toggle
set local "request.jwt.claims" = '{"sub": "d0000000-0000-0000-0000-000000000001"}';
select is(public.get_digest_preference(), true, 'Digest defaults to true for authenticated user');
select is(public.set_digest_preference(false), true, 'User can toggle digest to false');
select is(public.get_digest_preference(), false, 'Digest preference is now false');
select is(public.set_digest_preference(true), true, 'User can re-enable digest');
select is(public.get_digest_preference(), true, 'Digest preference is now true again');

reset role;

-- Service role claiming and execution tests
create temporary table first_claim as select * from public.claim_monthly_digests(10);
select cmp_ok((select count(*)::int from first_claim), '>=', 2, 'Verified accounts with decks are claimed');

-- Verify active lease prevents immediate re-claim
select is_empty($$ select * from public.claim_monthly_digests(10) $$, 'Active lease prevents double sending');

-- Test finish delivery
select is(public.finish_monthly_digest('d0000000-0000-0000-0000-000000000001', gen_random_uuid(), true, 10, false), false,
  'Forged or stale lease cannot record completion');

select is(public.finish_monthly_digest(user_id, lease_id, true, 10, false), true,
  'Valid lease records completion') from first_claim where user_id = 'd0000000-0000-0000-0000-000000000001';

-- Test unsubscribe RPC
select is(public.unsubscribe_monthly_digest('d0000000-0000-0000-0000-000000000002'), true, 'Admin unsubscribe succeeds');

rollback;
