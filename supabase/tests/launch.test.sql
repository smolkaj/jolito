begin;
select plan(7);

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'launch@example.com');
insert into public.decks (user_id, device_id, data) values
  ('33333333-3333-3333-3333-333333333333', 'launch', '{"cards":[]}');
insert into public.feedback (user_id, email, message) values
  ('33333333-3333-3333-3333-333333333333', 'launch@example.com', 'Hello!');

set local role authenticated;
set local "request.jwt.claims" = '{"role":"authenticated","sub":"33333333-3333-3333-3333-333333333333"}';
select lives_ok('select public.delete_user_account()', 'Account deletion executes for its owner');
reset role;
select is_empty($$select id from auth.users where id = '33333333-3333-3333-3333-333333333333'$$, 'Account is deleted');
select is_empty($$select user_id from public.decks where user_id = '33333333-3333-3333-3333-333333333333'$$, 'Deck deletion cascades');
select is_empty($$select id from public.feedback where user_id = '33333333-3333-3333-3333-333333333333'$$, 'Feedback deletion cascades');

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
select throws_ok($$insert into public.feedback(email,message) values ('guest@example.com',repeat('x',5001))$$, '23514', null, 'Direct REST cannot bypass message bounds');
select throws_ok($$insert into public.feedback(email,message,context) values ('guest@example.com','hello',jsonb_build_object('x',repeat('x',9000)))$$, '23514', null, 'Direct REST cannot bypass context bounds');
insert into public.feedback(email,message,created_at)
  select 'guest@example.com','hello','2000-01-01'::timestamptz from generate_series(1,30);
select throws_ok($$insert into public.feedback(email,message) values ('guest@example.com','one too many')$$, 'P0001', null, 'Guest quota cannot be bypassed with a forged timestamp');
select * from finish();
rollback;
