-- Receiving points from Overland (free iPhone app that records in the background and posts
-- batches of GeoJSON points to a URL). The edge function "overland" checks the token and stores
-- the points; the web app fetches its own points and turns them into outings on the device.

-- Secret tokens per user. Only the SHA-256 hash is stored, never the token itself.
create table public.receive_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index receive_tokens_user_id_idx on public.receive_tokens (user_id);

-- Raw points as received. One row per point; a resent batch is ignored (unique per user and time).
create table public.received_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  t timestamptz not null,
  lon double precision not null check (lon between -180 and 180),
  lat double precision not null check (lat between -90 and 90),
  acc real check (acc is null or acc >= 0),
  received_at timestamptz not null default now(),
  unique (user_id, t)
);

alter table public.receive_tokens enable row level security;
alter table public.received_points enable row level security;

-- Tokens: create, see and delete only your own.
create policy own_rows on public.receive_tokens for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Points: read and delete only your own. Inserts only by the edge function (service role).
create policy read_own on public.received_points for select to authenticated
  using ((select auth.uid()) = user_id);
create policy delete_own on public.received_points for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.receive_tokens, public.received_points from anon;
revoke insert, update on public.received_points from authenticated;
