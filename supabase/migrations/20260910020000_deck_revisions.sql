-- Snapshot writes use compare-and-set revisions. Old REST upserts must fail
-- explicitly rather than bypass concurrency checks or overwrite newer metadata.
alter table public.decks add column revision bigint not null default 1
  check (revision > 0 and revision <= 9007199254740991);

create function public.compare_and_set_deck(
  p_user_id uuid,
  p_expected_revision bigint,
  p_data jsonb
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  written_revision bigint;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then
    raise exception 'Deck owner does not match signed-in account' using errcode = '42501';
  end if;
  if p_expected_revision < 0 or p_expected_revision >= 9007199254740991
    or p_expected_revision is null then
    raise exception 'Invalid deck revision' using errcode = '22023';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object'
    or p_data->>'app' is distinct from 'jolito'
    or p_data->'version' is distinct from '4'::jsonb
    or jsonb_typeof(p_data->'cards') is distinct from 'array'
    or jsonb_typeof(p_data->'deletedCardIds') is distinct from 'array'
    or jsonb_typeof(p_data->'deviceId') is distinct from 'string' then
    raise exception 'Invalid deck snapshot' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.decks (user_id, device_id, version, data, revision)
    values (p_user_id, p_data->>'deviceId', 4, p_data, 1)
    on conflict (user_id) do nothing
    returning revision into written_revision;
  else
    update public.decks
    set data = p_data, device_id = p_data->>'deviceId', version = 4,
        updated_at = now(), revision = revision + 1
    where user_id = p_user_id and revision = p_expected_revision
    returning revision into written_revision;
  end if;
  return written_revision;
end;
$$;

revoke all on function public.compare_and_set_deck(uuid, bigint, jsonb) from public, anon;
grant execute on function public.compare_and_set_deck(uuid, bigint, jsonb) to authenticated;
revoke insert, update, delete on public.decks from anon, authenticated;
