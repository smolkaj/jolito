-- Jolito Cloud Sync: User Deck Deletion Policy
-- Complies with Apple App Store Review Guideline 5.1.1(v) for in-app data and account deletion.

create policy "Users can delete their own deck"
  on public.decks for delete
  using (auth.uid() = user_id);
