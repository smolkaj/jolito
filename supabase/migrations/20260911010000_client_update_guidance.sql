-- Retire the unversioned table API with guidance that already-shipped clients
-- display before parsing newer data. CAS remains the only client write path.
create function public.read_deck_snapshot()
returns setof public.decks
language sql stable security invoker
set search_path = ''
as $$
  select * from public.decks where user_id = (select auth.uid());
$$;
revoke all on function public.read_deck_snapshot() from public, anon;
grant execute on function public.read_deck_snapshot() to authenticated;

create function public.check_deck_client()
returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
    and current_setting('request.path', true) = '/decks' then
    raise sqlstate 'PT409' using message =
      'Update Jolito to sync. Save unfinished edits and export a deck backup first. Keep this device''s app data. For safe update steps, open https://joli.to/update in your browser.';
  end if;
end;
$$;
revoke all on function public.check_deck_client() from public;
grant execute on function public.check_deck_client() to anon, authenticated, service_role;

-- This repository owns the hook. Refuse to silently replace external policy.
do $$
begin
  if exists (
    select 1 from pg_db_role_setting, unnest(setconfig) as setting
    where (setrole = 0 or setrole = (select oid from pg_roles where rolname = 'authenticator'))
      and setting like 'pgrst.db_pre_request=%'
      and setting not in ('pgrst.db_pre_request=', 'pgrst.db_pre_request=public.check_deck_client')
  ) then
    raise exception 'An existing PostgREST pre-request hook must be reconciled before installing client update guidance';
  end if;
end;
$$;
alter role authenticator set pgrst.db_pre_request = 'public.check_deck_client';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
