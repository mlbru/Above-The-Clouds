-- Run once in the Supabase SQL editor (Project -> SQL Editor -> New query).
-- One row per player and mode; the game only ever raises a player's height.
create table if not exists public.scores (
  player_id uuid not null,
  mode text not null check (mode in ('normal', 'hard', 'summit')),
  name text not null check (char_length(name) between 1 and 12),
  height real not null check (height >= 0 and height <= 5000),
  updated_at timestamptz not null default now(),
  primary key (player_id, mode)
);

create index if not exists scores_mode_height on public.scores (mode, height desc);

-- A row can never get lower, whatever the client sends.
create or replace function public.keep_best_height() returns trigger as $$
begin
  new.height := greatest(old.height, new.height);
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists scores_keep_best on public.scores;
create trigger scores_keep_best before update on public.scores
  for each row execute function public.keep_best_height();

alter table public.scores enable row level security;

drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores" on public.scores for select using (true);

drop policy if exists "anyone can add a score" on public.scores;
create policy "anyone can add a score" on public.scores for insert with check (true);

drop policy if exists "anyone can raise a score" on public.scores;
create policy "anyone can raise a score" on public.scores for update using (true) with check (true);
