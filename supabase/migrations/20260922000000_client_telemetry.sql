-- Privacy-Preserving Client Demographics & Engagement Telemetry
-- Stores daily unique active users by pseudonymized monthly-rotating hash.
-- No personal identifiers, IP addresses, or permanent tracking tokens are stored.

create table if not exists public.client_activity_daily (
  date date not null,
  user_hash text not null,
  country text not null default 'unknown',
  platform text not null default 'unknown',
  os text not null default 'unknown',
  browser text not null default 'unknown',
  device_type text not null default 'unknown',
  engagement_tier text not null default 'casual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (date, user_hash)
);

create index if not exists idx_client_activity_daily_country
  on public.client_activity_daily (country);

create index if not exists idx_client_activity_daily_platform
  on public.client_activity_daily (platform);

-- Enable Row Level Security (no public read/write by default)
alter table public.client_activity_daily enable row level security;

-- Function to record or upgrade daily client activity atomically
create or replace function public.record_client_activity(
  p_user_hash text,
  p_country text default 'unknown',
  p_platform text default 'unknown',
  p_os text default 'unknown',
  p_browser text default 'unknown',
  p_device_type text default 'unknown',
  p_engagement_tier text default 'casual'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_hash text := trim(coalesce(p_user_hash, ''));
  v_country text := lower(trim(coalesce(p_country, 'unknown')));
  v_platform text := lower(trim(coalesce(p_platform, 'unknown')));
  v_os text := trim(coalesce(p_os, 'unknown'));
  v_browser text := trim(coalesce(p_browser, 'unknown'));
  v_device_type text := lower(trim(coalesce(p_device_type, 'unknown')));
  v_tier text := lower(trim(coalesce(p_engagement_tier, 'casual')));
begin
  if length(v_hash) < 16 or length(v_hash) > 128 then
    raise exception 'Invalid user hash';
  end if;

  if v_tier not in ('casual', 'active', 'deep') then
    v_tier := 'casual';
  end if;

  insert into public.client_activity_daily (
    date,
    user_hash,
    country,
    platform,
    os,
    browser,
    device_type,
    engagement_tier,
    created_at,
    updated_at
  ) values (
    v_today,
    v_hash,
    v_country,
    v_platform,
    v_os,
    v_browser,
    v_device_type,
    v_tier,
    now(),
    now()
  )
  on conflict (date, user_hash)
  do update set
    country = case when client_activity_daily.country = 'unknown' and excluded.country != 'unknown' then excluded.country else client_activity_daily.country end,
    platform = case when client_activity_daily.platform = 'unknown' and excluded.platform != 'unknown' then excluded.platform else client_activity_daily.platform end,
    os = case when client_activity_daily.os = 'unknown' and excluded.os != 'unknown' then excluded.os else client_activity_daily.os end,
    browser = case when client_activity_daily.browser = 'unknown' and excluded.browser != 'unknown' then excluded.browser else client_activity_daily.browser end,
    device_type = case when client_activity_daily.device_type = 'unknown' and excluded.device_type != 'unknown' then excluded.device_type else client_activity_daily.device_type end,
    engagement_tier = case
      when excluded.engagement_tier = 'deep' then 'deep'
      when excluded.engagement_tier = 'active' and client_activity_daily.engagement_tier != 'deep' then 'active'
      else client_activity_daily.engagement_tier
    end,
    updated_at = now();
end;
$$;

revoke all on function public.record_client_activity(text, text, text, text, text, text, text) from public;
grant execute on function public.record_client_activity(text, text, text, text, text, text, text) to anon, authenticated;

-- Function to retrieve high-level aggregate telemetry summary
-- Returns strictly anonymized rollups; never exposes user hashes
create or replace function public.get_telemetry_summary(
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since date := (now() at time zone 'utc')::date - p_days;
  v_unique_users bigint;
  v_by_country jsonb;
  v_by_platform jsonb;
  v_by_engagement jsonb;
begin
  select count(distinct user_hash) into v_unique_users
  from public.client_activity_daily
  where date >= v_since;

  select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) into v_by_country
  from (
    select country, count(distinct user_hash) as unique_users, count(*) as active_days
    from public.client_activity_daily
    where date >= v_since
    group by country
    order by unique_users desc
    limit 20
  ) c;

  select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) into v_by_platform
  from (
    select platform, count(distinct user_hash) as unique_users, count(*) as active_days
    from public.client_activity_daily
    where date >= v_since
    group by platform
    order by unique_users desc
  ) p;

  select coalesce(jsonb_agg(row_to_json(e)), '[]'::jsonb) into v_by_engagement
  from (
    select engagement_tier, count(*) as count
    from public.client_activity_daily
    where date >= v_since
    group by engagement_tier
    order by count desc
  ) e;

  return jsonb_build_object(
    'days', p_days,
    'since', v_since,
    'unique_users', v_unique_users,
    'by_country', v_by_country,
    'by_platform', v_by_platform,
    'by_engagement', v_by_engagement
  );
end;
$$;

revoke all on function public.get_telemetry_summary(integer) from public, anon;
grant execute on function public.get_telemetry_summary(integer) to service_role, authenticated;
