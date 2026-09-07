-- Jolito Cloud Sync: User Deck & Account Deletion Policy
-- Complies with Apple App Store Review Guideline 5.1.1(v) for in-app data and account deletion.

create policy "Users can delete their own deck"
  on public.decks for delete
  using (auth.uid() = user_id);

-- Allow authenticated users to permanently delete their account and cascaded data
create or replace function public.delete_user_account()
returns void
language sql
security definer
set search_path = public
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_user_account() from public;
grant execute on function public.delete_user_account() to authenticated;
