-- Things that used to live only on the phone (stamps given, "Hier komme ich nicht hin",
-- pen colours) are kept with the account too, so a new phone gets them back (Bauplan 3, A2).
create table if not exists public.user_state (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  stempel jsonb not null default '[]'::jsonb,
  ausnahmen jsonb not null default '[]'::jsonb,
  stifte jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

create policy "own state: read" on public.user_state
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own state: add" on public.user_state
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own state: change" on public.user_state
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
