-- Places walked in that have no region yet ("Lissabon wird vorbereitet", Bauplan 3.3).
-- The app reports them here; they are prepared (npm run region) and then counted.
create table if not exists public.region_wishes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  lon double precision not null,
  lat double precision not null,
  meters real not null default 0,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.region_wishes enable row level security;

create policy "own wishes: read" on public.region_wishes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "own wishes: add" on public.region_wishes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own wishes: change" on public.region_wishes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own wishes: remove" on public.region_wishes
  for delete to authenticated using ((select auth.uid()) = user_id);
