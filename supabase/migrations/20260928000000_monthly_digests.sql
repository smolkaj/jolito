-- Monthly deck backup and progress digest tracking
create schema if not exists private;

create table if not exists private.monthly_digests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  digest_enabled boolean not null default true,
  last_sent_at timestamptz,
  last_lifetime_reviews integer not null default 0,
  status text not null default 'active' check (status in ('active', 'paused', 'unsubscribed', 'failed')),
  attempts integer not null default 0,
  lease_id uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table private.monthly_digests enable row level security;
revoke all on private.monthly_digests from public, anon, authenticated;

-- Automatically reactivate paused or failed digests when a learner saves/syncs cards to their deck
create or replace function private.reactivate_paused_digest()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update private.monthly_digests
  set status = 'active', attempts = 0, updated_at = now()
  where user_id = new.user_id and status in ('paused', 'failed');
  return new;
end;
$$;

drop trigger if exists reactivate_digest_on_deck_update on public.decks;
create trigger reactivate_digest_on_deck_update
  after insert or update on public.decks
  for each row execute function private.reactivate_paused_digest();

create or replace function public.claim_monthly_digests(p_limit integer default 50)
returns table (
  user_id uuid,
  email text,
  last_lifetime_reviews integer,
  lease_id uuid
)
language plpgsql security definer set search_path = ''
as $$
begin
  insert into private.monthly_digests (user_id, last_sent_at)
  select u.id, coalesce(u.created_at, now()) from auth.users u
  join public.decks d on d.user_id = u.id
  where u.email_confirmed_at is not null and u.last_sign_in_at is not null
    and u.email is not null and u.email <> '' and not coalesce(u.is_anonymous, false)
    and not exists (select 1 from private.monthly_digests md where md.user_id = u.id)
  on conflict do nothing;

  return query
  with candidates as (
    select md.user_id from private.monthly_digests md
    join auth.users u on u.id = md.user_id
    where md.digest_enabled = true
      and md.status = 'active'
      and (md.lease_until is null or md.lease_until <= now())
      and (md.last_sent_at is null or md.last_sent_at <= now() - interval '28 days')
      and u.email_confirmed_at is not null
      and u.email is not null and u.email <> ''
      and not coalesce(u.is_anonymous, false)
    order by md.last_sent_at nulls first, md.user_id
    limit coalesce(p_limit, 50)
    for update of md skip locked
  ), claimed as (
    update private.monthly_digests md
    set lease_id = gen_random_uuid(), lease_until = now() + interval '30 minutes',
        attempts = md.attempts + 1,
        updated_at = now()
    from candidates c where md.user_id = c.user_id
    returning md.user_id, md.lease_id, md.last_lifetime_reviews
  )
  select c.user_id, u.email::text, c.last_lifetime_reviews, c.lease_id
  from claimed c
  join auth.users u on u.id = c.user_id;
end;
$$;

create or replace function public.finish_monthly_digest(
  p_user_id uuid,
  p_lease_id uuid,
  p_delivered boolean,
  p_new_lifetime_reviews integer default 0,
  p_auto_paused boolean default false,
  p_permanent_failure boolean default false
)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update private.monthly_digests
  set status = case
      when p_permanent_failure then 'failed'
      when not p_delivered and attempts >= 3 then 'failed'
      when not p_delivered then status
      when p_auto_paused then 'paused'
      else 'active'
    end,
    attempts = case when p_delivered then 0 else attempts end,
    last_sent_at = case when p_delivered then now() else last_sent_at end,
    last_lifetime_reviews = case when p_delivered then coalesce(p_new_lifetime_reviews, last_lifetime_reviews) else last_lifetime_reviews end,
    lease_id = null,
    lease_until = case when p_delivered or p_permanent_failure or attempts >= 3 then null else now() + interval '5 minutes' end,
    updated_at = now()
  where user_id = p_user_id and lease_id = p_lease_id
    and lease_until > now();
  return found;
end;
$$;

create or replace function public.unsubscribe_monthly_digest(p_user_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  update private.monthly_digests
  set digest_enabled = false,
      status = 'unsubscribed',
      updated_at = now()
  where user_id = p_user_id;
  return found;
end;
$$;

create or replace function public.get_digest_preference()
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  return coalesce(
    (select md.digest_enabled from private.monthly_digests md where md.user_id = auth.uid()),
    true
  );
end;
$$;

create or replace function public.set_digest_preference(p_enabled boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_user_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select coalesce(created_at, now()) into v_user_created_at
  from auth.users where id = auth.uid();

  insert into private.monthly_digests (user_id, digest_enabled, status, last_sent_at)
  values (auth.uid(), p_enabled, case when p_enabled then 'active' else 'unsubscribed' end, coalesce(v_user_created_at, now()))
  on conflict (user_id) do update
  set digest_enabled = p_enabled,
      status = case when p_enabled then 'active' else 'unsubscribed' end,
      updated_at = now();
  return true;
end;
$$;

revoke all on function public.claim_monthly_digests(integer) from public, anon, authenticated;
revoke all on function public.finish_monthly_digest(uuid, uuid, boolean, integer, boolean, boolean) from public, anon, authenticated;
revoke all on function public.unsubscribe_monthly_digest(uuid) from public, anon, authenticated;
grant execute on function public.claim_monthly_digests(integer) to service_role;
grant execute on function public.finish_monthly_digest(uuid, uuid, boolean, integer, boolean, boolean) to service_role;
grant execute on function public.unsubscribe_monthly_digest(uuid) to service_role;

revoke all on function public.get_digest_preference() from public, anon;
revoke all on function public.set_digest_preference(boolean) from public, anon;
grant execute on function public.get_digest_preference() to authenticated;
grant execute on function public.set_digest_preference(boolean) to authenticated;
