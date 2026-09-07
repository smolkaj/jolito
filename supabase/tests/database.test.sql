begin;
select plan(20);

-- 1. Verify tables exist
select has_table('public', 'decks', 'public.decks table exists');
select has_table('public', 'feedback', 'public.feedback table exists');

-- 2. Verify columns
select columns_are('public', 'decks', array['user_id', 'updated_at', 'device_id', 'version', 'data'], 'decks has expected columns');
select columns_are('public', 'feedback', array['id', 'user_id', 'email', 'message', 'context', 'created_at'], 'feedback has expected columns');

-- 3. Verify RLS is enabled
select ok(
  (select relrowsecurity from pg_class where oid = 'public.decks'::regclass),
  'public.decks has row security enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.feedback'::regclass),
  'public.feedback has row security enabled'
);

-- Setup test users in auth.users
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'learner_a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'learner_b@example.com');

-- 4. Test RLS for Decks as unauthenticated / anon
set local role anon;
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role": "anon"}';

select throws_ok(
  $$ insert into public.decks (user_id, device_id, data) values ('11111111-1111-1111-1111-111111111111', 'anon-dev', '{}'::jsonb) $$,
  '42501',
  null,
  'Anon cannot insert decks'
);

select is_empty(
  $$ select * from public.decks $$,
  'Anon cannot read decks'
);

-- 5. Test RLS for Decks as User A
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
set local "request.jwt.claims" = '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$ insert into public.decks (user_id, device_id, data) values ('11111111-1111-1111-1111-111111111111', 'dev-a', '{"cards":[]}'::jsonb) $$,
  'User A can insert own deck'
);

select results_eq(
  $$ select user_id from public.decks $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'User A can view own deck'
);

-- 6. Test User B cannot see or modify User A's deck
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
set local "request.jwt.claims" = '{"role": "authenticated", "sub": "22222222-2222-2222-2222-222222222222"}';

select is_empty(
  $$ select * from public.decks $$,
  'User B cannot see User A deck'
);

select throws_ok(
  $$ insert into public.decks (user_id, device_id, data) values ('11111111-1111-1111-1111-111111111111', 'dev-b', '{}'::jsonb) $$,
  '42501',
  null,
  'User B cannot insert deck with User A id'
);

-- 7. Test Feedback RLS as Anon (Guest flow)
set local role anon;
set local "request.jwt.claim.role" = 'anon';
set local "request.jwt.claim.sub" = '';
set local "request.jwt.claims" = '{"role": "anon"}';

select lives_ok(
  $$ insert into public.feedback (user_id, email, message) values (null, 'guest@example.com', 'Love Jolito!') $$,
  'Guest can insert feedback when user_id is null'
);

select throws_ok(
  $$ insert into public.feedback (user_id, email, message) values ('11111111-1111-1111-1111-111111111111', 'guest@example.com', 'Impersonating') $$,
  '42501',
  null,
  'Guest cannot insert feedback with spoofed user_id'
);

select is_empty(
  $$ select * from public.feedback $$,
  'Anon cannot read any feedback'
);

-- 8. Test Feedback RLS as Authenticated User
set local role authenticated;
set local "request.jwt.claim.role" = 'authenticated';
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
set local "request.jwt.claims" = '{"role": "authenticated", "sub": "11111111-1111-1111-1111-111111111111"}';

select lives_ok(
  $$ insert into public.feedback (user_id, email, message) values ('11111111-1111-1111-1111-111111111111', 'learner_a@example.com', 'User A feedback') $$,
  'User A can insert feedback with own user_id'
);

select throws_ok(
  $$ insert into public.feedback (user_id, email, message) values ('22222222-2222-2222-2222-222222222222', 'learner_a@example.com', 'User A spoofing User B') $$,
  '42501',
  null,
  'User A cannot insert feedback with User B user_id'
);

select results_eq(
  $$ select message from public.feedback $$,
  $$ values ('User A feedback'::text) $$,
  'User A can only view own submitted feedback'
);

select is_empty(
  $$ update public.feedback set message = 'Hacked' where user_id = '11111111-1111-1111-1111-111111111111' returning 1 $$,
  'Authenticated users cannot update feedback (0 rows affected)'
);

select is_empty(
  $$ delete from public.feedback where user_id = '11111111-1111-1111-1111-111111111111' returning 1 $$,
  'Authenticated users cannot delete feedback (0 rows affected)'
);

select * from finish();
rollback;
