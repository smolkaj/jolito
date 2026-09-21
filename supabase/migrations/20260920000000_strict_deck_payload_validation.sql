-- Enforce strict deck payload schema at database ingress.
-- Both compare_and_set_deck and table-level check constraints ensure that
-- invalid or unversioned metadata (such as non-string timestamps or missing keys)
-- can never enter public.decks via RPC or administrative direct writes.

create or replace function public.compare_and_set_deck(
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
    or jsonb_typeof(p_data->'updatedAt') is distinct from 'string'
    or length(p_data->>'updatedAt') = 0
    or jsonb_typeof(p_data->'cards') is distinct from 'array'
    or jsonb_typeof(p_data->'deletedCardIds') is distinct from 'array'
    or jsonb_typeof(p_data->'deviceId') is distinct from 'string'
    or length(p_data->>'deviceId') = 0 then
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

alter table public.decks add constraint check_deck_payload_schema check (
  data is not null
  and jsonb_typeof(data) = 'object'
  and data->>'app' = 'jolito'
  and data->'version' in ('1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb)
  and jsonb_typeof(data->'updatedAt') = 'string'
  and length(data->>'updatedAt') > 0
  and jsonb_typeof(data->'deviceId') = 'string'
  and length(data->>'deviceId') > 0
  and jsonb_typeof(data->'cards') = 'array'
  and jsonb_typeof(data->'deletedCardIds') = 'array'
);
