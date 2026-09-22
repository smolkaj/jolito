begin;
select plan(10);

-- 1. Test basic recording via record_client_activity
select lives_ok(
  $$ select public.record_client_activity('hash_0123456789abcdef0123456789abcdef', 'us', 'ios', 'iOS 18.0', 'Mobile Safari', 'mobile', 'casual'); $$,
  'Can record client activity with casual tier'
);

-- 2. Verify row was created
select results_eq(
  $$ select country, platform, os, browser, device_type, engagement_tier from public.client_activity_daily where user_hash = 'hash_0123456789abcdef0123456789abcdef' $$,
  $$ values ('us'::text, 'ios'::text, 'iOS 18.0'::text, 'Mobile Safari'::text, 'mobile'::text, 'casual'::text) $$,
  'Row is properly stored with all demographic attributes'
);

-- 3. Upgrade to active
select lives_ok(
  $$ select public.record_client_activity('hash_0123456789abcdef0123456789abcdef', 'us', 'ios', 'iOS 18.0', 'Mobile Safari', 'mobile', 'active'); $$,
  'Can upgrade engagement tier to active'
);

select results_eq(
  $$ select engagement_tier from public.client_activity_daily where user_hash = 'hash_0123456789abcdef0123456789abcdef' $$,
  $$ values ('active'::text) $$,
  'Engagement tier upgraded to active'
);

-- 4. Casual cannot downgrade active
select lives_ok(
  $$ select public.record_client_activity('hash_0123456789abcdef0123456789abcdef', 'us', 'ios', 'iOS 18.0', 'Mobile Safari', 'mobile', 'casual'); $$,
  'Casual submission does not downgrade'
);

select results_eq(
  $$ select engagement_tier from public.client_activity_daily where user_hash = 'hash_0123456789abcdef0123456789abcdef' $$,
  $$ values ('active'::text) $$,
  'Engagement tier remains active after casual submission'
);

-- 5. Invalid user hash raises error
select throws_ok(
  $$ select public.record_client_activity('short', 'us', 'web', 'macOS', 'Chrome', 'desktop', 'casual'); $$,
  'Invalid user hash',
  'Throws on invalid user hash length'
);

-- 6. Add second user and test get_telemetry_summary
select lives_ok(
  $$ select public.record_client_activity('hash_fedcba9876543210fedcba9876543210', 'de', 'web', 'macOS', 'Firefox', 'desktop', 'deep'); $$,
  'Can record second client activity'
);

select lives_ok(
  $$ select public.get_telemetry_summary(30) $$,
  'Can execute get_telemetry_summary'
);

select is(
  (public.get_telemetry_summary(30)->>'unique_users')::bigint,
  2::bigint,
  'Summary returns correct unique user count'
);

select * from finish();
rollback;
