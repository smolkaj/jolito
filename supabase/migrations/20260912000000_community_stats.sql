-- Community statistics for public display (learners, cards created, card reviews completed)
-- Returns aggregate counts only; no personal data or sensitive fields are exposed.

create or replace function public.get_community_stats()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_users integer;
  total_cards bigint;
  total_reviews bigint;
begin
  select count(*) into total_users
  from auth.users
  where email_confirmed_at is not null;

  select
    coalesce(sum(case when jsonb_typeof(data->'cards') = 'array' then jsonb_array_length(data->'cards') else 0 end), 0),
    coalesce(sum((
      select coalesce(sum((card->'schedule'->>'reviews')::bigint), 0)
      from jsonb_array_elements(
        case when jsonb_typeof(data->'cards') = 'array' then data->'cards' else '[]'::jsonb end
      ) as card
    )), 0)
  into total_cards, total_reviews
  from public.decks;

  return jsonb_build_object(
    'learners', total_users,
    'cards', total_cards,
    'reviews', total_reviews
  );
end;
$$;

revoke all on function public.get_community_stats() from public;
grant execute on function public.get_community_stats() to anon, authenticated;
