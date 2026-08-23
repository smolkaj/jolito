-- Jolito Cloud Sync Schema (Supabase PostgreSQL)
-- Multi-device local-first snapshot replication with Row Level Security (RLS)

create table if not exists public.decks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  device_id text not null,
  version integer not null default 1,
  data jsonb not null
);

-- Enable Row Level Security
alter table public.decks enable row level security;

-- Policies: Each user can only read and write their own deck
create policy "Users can view their own deck"
  on public.decks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own deck"
  on public.decks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own deck"
  on public.decks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
