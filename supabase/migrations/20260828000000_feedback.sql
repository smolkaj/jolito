-- Jolito Feedback Schema (Supabase PostgreSQL)
-- Authenticated and guest feedback submissions with Row Level Security (RLS)

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.feedback enable row level security;

-- Policies: Authenticated users and guests can insert feedback
create policy "Users and guests can insert feedback"
  on public.feedback for insert
  to anon, authenticated
  with check (
    (user_id is null and auth.uid() is null)
    or (user_id = auth.uid())
  );

-- Policies: Users can view their own submitted feedback
create policy "Users can view their own feedback"
  on public.feedback for select
  to authenticated
  using (auth.uid() = user_id);
