-- Auth remains the durable event source. No notification trigger runs in the
-- learner's signup transaction; delivery outages cannot block authentication.
create schema if not exists private;

create table private.signup_notifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'suppressed')),
  lease_id uuid,
  lease_until timestamptz,
  attempts integer not null default 0,
  sent_at timestamptz
);
alter table private.signup_notifications enable row level security;
revoke all on private.signup_notifications from public, anon, authenticated;

-- Existing verified accounts are not new signups. Unverified accounts that
-- verify later remain eligible. This baseline is applied once, by migration.
insert into private.signup_notifications (user_id, status)
select id, 'suppressed' from auth.users where email_confirmed_at is not null;

create function public.claim_signup_notifications()
returns table (user_id uuid, email text, verified_at timestamptz, lease_id uuid)
language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.signup_notifications (user_id)
  select u.id from auth.users u
  where u.email_confirmed_at is not null and u.last_sign_in_at is not null
    and u.email is not null and u.email <> '' and not coalesce(u.is_anonymous, false)
    and not exists (select 1 from private.signup_notifications n where n.user_id = u.id)
  order by u.email_confirmed_at, u.id
  limit 10
  on conflict do nothing;

  return query
  with candidates as (
    select n.user_id from private.signup_notifications n
    join auth.users u on u.id = n.user_id
    where n.status = 'pending' and (n.lease_until is null or n.lease_until <= now())
      and u.email_confirmed_at is not null and u.last_sign_in_at is not null
      and u.email is not null and u.email <> '' and not coalesce(u.is_anonymous, false)
    order by n.lease_until nulls first, u.email_confirmed_at, n.user_id
    limit 10
    for update of n skip locked
  ), claimed as (
    update private.signup_notifications n
    set lease_id = gen_random_uuid(), lease_until = now() + interval '30 minutes',
      attempts = n.attempts + 1
    from candidates c where n.user_id = c.user_id
    returning n.user_id, n.lease_id
  )
  select c.user_id, u.email::text, u.email_confirmed_at, c.lease_id
  from claimed c join auth.users u on u.id = c.user_id;
end;
$$;

create function public.finish_signup_notification(p_user_id uuid, p_lease_id uuid, p_delivered boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update private.signup_notifications
  set status = case when p_delivered then 'sent' else 'pending' end,
    sent_at = case when p_delivered then now() else null end,
    lease_id = null,
    lease_until = case when p_delivered then null else now() + interval '5 minutes' end
  where user_id = p_user_id and lease_id = p_lease_id
    and status = 'pending' and lease_until > now();
  return found;
end;
$$;

revoke all on function public.claim_signup_notifications() from public, anon, authenticated;
revoke all on function public.finish_signup_notification(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_signup_notifications() to service_role;
grant execute on function public.finish_signup_notification(uuid, uuid, boolean) to service_role;
