-- Paste this into Supabase SQL Editor after creating the project.
-- Canonical game model fields:
--   play_status: need_to_play | playing | completed | dropped
--   acquisition_status: unknown | owned | needs_acquiring | not_applicable
-- Optional local/library fields:
--   acquired_at, source_notes, rom_path, library_match_id
-- The legacy status column is retained as a compatibility mirror of play_status;
-- new app code should read and write play_status.

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  platform text,
  play_status text not null default 'need_to_play' check (play_status in ('need_to_play', 'playing', 'completed', 'dropped')),
  acquisition_status text not null default 'unknown' check (acquisition_status in ('unknown', 'owned', 'needs_acquiring', 'not_applicable')),
  status text,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  rating text,
  tags text[] not null default '{}',
  cover_url text,
  notes text,
  acquired_at date,
  source_notes text,
  rom_path text,
  library_match_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.games add column if not exists play_status text;
alter table public.games add column if not exists acquisition_status text;
alter table public.games add column if not exists acquired_at date;
alter table public.games add column if not exists source_notes text;
alter table public.games add column if not exists rom_path text;
alter table public.games add column if not exists library_match_id text;

alter table public.games drop constraint if exists games_status_check;
alter table public.games drop constraint if exists games_play_status_check;
alter table public.games drop constraint if exists games_acquisition_status_check;

update public.games
set play_status = case
  when play_status in ('need_to_play', 'playing', 'completed', 'dropped') then play_status
  when play_status = 'interested' then 'need_to_play'
  when play_status = 'played' then 'completed'
  when status in ('need_to_play', 'playing', 'completed', 'dropped') then status
  when status = 'interested' then 'need_to_play'
  when status = 'played' then 'completed'
  when status in ('playing', 'dropped') then status
  else 'need_to_play'
end
where play_status is null or play_status not in ('need_to_play', 'playing', 'completed', 'dropped');

update public.games
set acquisition_status = 'unknown'
where acquisition_status is null or acquisition_status not in ('unknown', 'owned', 'needs_acquiring', 'not_applicable');

update public.games
set status = play_status
where status is null or status in ('interested', 'played') or status <> play_status;

alter table public.games alter column play_status set default 'need_to_play';
alter table public.games alter column play_status set not null;
alter table public.games add constraint games_play_status_check check (play_status in ('need_to_play', 'playing', 'completed', 'dropped'));

alter table public.games alter column acquisition_status set default 'unknown';
alter table public.games alter column acquisition_status set not null;
alter table public.games add constraint games_acquisition_status_check check (acquisition_status in ('unknown', 'owned', 'needs_acquiring', 'not_applicable'));

alter table public.games alter column status set default 'need_to_play';
alter table public.games add constraint games_status_check check (status in ('need_to_play', 'playing', 'completed', 'dropped'));

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
