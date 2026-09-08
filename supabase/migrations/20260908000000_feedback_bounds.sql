-- Bound direct REST inserts as well as the app's feedback form.
-- NOT VALID preserves existing data; the checks apply to all new/updated rows.
alter table public.feedback add constraint feedback_message_bound
  check (char_length(btrim(message)) between 1 and 5000) not valid;
alter table public.feedback add constraint feedback_email_bound
  check (char_length(email) between 1 and 320) not valid;
alter table public.feedback add constraint feedback_context_bound
  check (jsonb_typeof(context) = 'object' and octet_length(context::text) <= 8192) not valid;

create index feedback_recent_user on public.feedback (user_id, created_at);

create function public.limit_feedback_inserts()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  recent_count integer;
begin
  -- A guest bucket bounds anonymous writes without retaining IP addresses.
  -- Serialize check + insert so concurrent requests cannot bypass the limit.
  perform pg_advisory_xact_lock(hashtextextended('jolito-feedback:' || coalesce(caller::text, 'guest'), 0));
  select count(*) into recent_count from public.feedback
    where user_id is not distinct from caller
      and created_at > clock_timestamp() - interval '1 minute';
  if recent_count >= (case when caller is null then 30 else 10 end) then
    raise exception 'A little breather—please try sending feedback in a minute.';
  end if;
  new.created_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.limit_feedback_inserts() from public;
create trigger limit_feedback_before_insert before insert on public.feedback
  for each row execute function public.limit_feedback_inserts();
