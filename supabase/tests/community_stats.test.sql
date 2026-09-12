begin;
select plan(5);

-- Set up test data
insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values
  ('b0000000-0000-0000-0000-000000000001', 'user1@example.com', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'user2@example.com', now(), now()),
  ('b0000000-0000-0000-0000-000000000003', 'unconfirmed@example.com', null, null);

-- User 1 has 2 cards, 5 total reviews
insert into public.decks (user_id, device_id, version, data, revision) values
  ('b0000000-0000-0000-0000-000000000001', 'dev-1', 4, jsonb_build_object(
    'cards', jsonb_build_array(
      jsonb_build_object('id', 'card-1', 'schedule', jsonb_build_object('reviews', 3)),
      jsonb_build_object('id', 'card-2', 'schedule', jsonb_build_object('reviews', 2))
    ),
    'deletedCardIds', jsonb_build_array()
  ), 1);

-- User 2 has 1 card with 0 reviews
insert into public.decks (user_id, device_id, version, data, revision) values
  ('b0000000-0000-0000-0000-000000000002', 'dev-2', 4, jsonb_build_object(
    'cards', jsonb_build_array(
      jsonb_build_object('id', 'card-3', 'schedule', jsonb_build_object('reviews', 0))
    ),
    'deletedCardIds', jsonb_build_array()
  ), 1);

-- Anon access
set local role anon;
select lives_ok($$ select public.get_community_stats() $$, 'Anon can execute get_community_stats');
select is(
  (public.get_community_stats()->>'learners')::integer,
  2,
  'Returns confirmed learners count across auth.users'
);
select is(
  (public.get_community_stats()->>'cards')::integer,
  3,
  'Returns total cards count across decks'
);
select is(
  (public.get_community_stats()->>'reviews')::integer,
  5,
  'Returns total reviews count across decks'
);

-- Authenticated access
set local role authenticated;
select lives_ok($$ select public.get_community_stats() $$, 'Authenticated user can execute get_community_stats');

reset role;
select * from finish();
rollback;
