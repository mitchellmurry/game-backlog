-- Paste this into Supabase SQL Editor after creating the project.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  platform text,
  status text not null default 'interested' check (status in ('interested', 'playing', 'played', 'dropped')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  rating text,
  tags text[] not null default '{}',
  cover_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games enable row level security;

drop policy if exists "Users can view their own games" on public.games;
create policy "Users can view their own games"
on public.games for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own games" on public.games;
create policy "Users can insert their own games"
on public.games for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own games" on public.games;
create policy "Users can update their own games"
on public.games for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own games" on public.games;
create policy "Users can delete their own games"
on public.games for delete
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
before update on public.games
for each row
execute function public.set_updated_at();
