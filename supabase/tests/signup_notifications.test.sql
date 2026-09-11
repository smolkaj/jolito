begin;
select no_plan();

-- Other local integration tests may have left accounts behind. Isolate these
-- fixtures inside this rolled-back transaction.
insert into private.signup_notifications (user_id, status)
select id, 'suppressed' from auth.users where email_confirmed_at is not null
on conflict (user_id) do update set status = 'suppressed';

insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  ('a0000000-0000-0000-0000-000000000001', 'verified@example.com', now(), now()),
  ('a0000000-0000-0000-0000-000000000002', 'unverified@example.com', null, null),
  ('a0000000-0000-0000-0000-000000000003', 'not-signed-in@example.com', now(), null);

set local role anon;
select throws_ok($$ select * from public.claim_signup_notifications() $$, '42501', null, 'Guests cannot claim notifications');
select throws_ok($$ select * from private.signup_notifications $$, '42501', null, 'Guests cannot read notification state');
set local role authenticated;
select throws_ok($$ select * from public.claim_signup_notifications() $$, '42501', null, 'Learners cannot claim notifications');
select throws_ok($$ select public.finish_signup_notification(gen_random_uuid(), gen_random_uuid(), true) $$, '42501', null, 'Learners cannot forge delivery receipts');
reset role;

create temporary table first_claim as select * from public.claim_signup_notifications();
select results_eq($$ select user_id from first_claim $$,
  $$ values ('a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'Only a verified learner who signed in is eligible');
select is_empty($$ select * from public.claim_signup_notifications() $$, 'An active lease prevents another send');
select is(public.finish_signup_notification('a0000000-0000-0000-0000-000000000001', gen_random_uuid(), true), false,
  'A stale or forged lease cannot record delivery');
select is(public.finish_signup_notification(user_id, lease_id, false), true,
  'Provider failure records an unsuccessful attempt') from first_claim;
select is_empty($$ select * from public.claim_signup_notifications() $$, 'Failure waits until retry time');

update private.signup_notifications set lease_until = now() - interval '1 second' where status = 'pending';
create temporary table retry_claim as select * from public.claim_signup_notifications();
select results_eq($$ select user_id from retry_claim $$, $$ select user_id from first_claim $$,
  'A later invocation recovers the failed event without the learner returning');
select isnt((select lease_id from retry_claim), (select lease_id from first_claim), 'Retry rotates the lease');
select is(public.finish_signup_notification(user_id, lease_id, true), false,
  'The earlier invocation cannot overwrite the retry') from first_claim;
select is(public.finish_signup_notification(user_id, lease_id, true), true,
  'Provider acceptance is recorded by the current lease') from retry_claim;
select is_empty($$ select * from public.claim_signup_notifications() $$, 'Delivered events stay delivered');

update auth.users set email_confirmed_at = now(), last_sign_in_at = now()
where id = 'a0000000-0000-0000-0000-000000000002';
create temporary table interrupted_claim as select * from public.claim_signup_notifications();
select results_eq($$ select user_id from interrupted_claim $$,
  $$ values ('a0000000-0000-0000-0000-000000000002'::uuid) $$,
  'An account becomes eligible after verification, even if created earlier');
update private.signup_notifications set lease_until = now() - interval '1 second' where status = 'pending';
select is(public.finish_signup_notification(user_id, lease_id, true), false,
  'Expired invocations cannot acknowledge delivery') from interrupted_claim;
create temporary table recovered_claim as select * from public.claim_signup_notifications();
select results_eq($$ select user_id from recovered_claim $$, $$ select user_id from interrupted_claim $$,
  'A terminated invocation recovers after lease expiry');
select is(public.finish_signup_notification(user_id, lease_id, true), true, 'Recovery can finish') from recovered_claim;

update auth.users set email = 'changed@example.com', email_confirmed_at = now(), last_sign_in_at = now()
where id = 'a0000000-0000-0000-0000-000000000001';
select is_empty($$ select * from public.claim_signup_notifications() $$, 'Repeat sign-ins and email changes do not create another signup');

delete from auth.users where id in (select user_id from first_claim union select user_id from interrupted_claim);
select is_empty($$ select * from private.signup_notifications where user_id::text like 'a0000000-%' $$,
  'Account deletion removes notification state');

set local role service_role;
select lives_ok($$ select * from public.claim_signup_notifications() $$, 'The delivery service can claim');
reset role;
select * from finish();
rollback;
