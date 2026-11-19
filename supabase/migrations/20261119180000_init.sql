-- Streifzug: initial schema (Phase 0).
-- Truth = raw tracks (files on R2) + coverage cells per tile. Progress tables are caches that can be rebuilt.
-- Every user table carries user_id and row level security.

create extension if not exists postgis with schema extensions;

-- Shared reference data: administrative areas from OpenStreetMap.
create table public.areas (
  id bigint generated always as identity primary key,
  osm_id bigint not null unique,
  name text not null,
  admin_level smallint not null check (admin_level between 2 and 11),
  parent_id bigint references public.areas (id) on delete set null,
  geom extensions.geometry(MultiPolygon, 4326) not null,
  total_m double precision not null default 0 check (total_m >= 0),
  data_version integer not null default 1,
  updated_at timestamptz not null default now()
);
create index areas_parent_id_idx on public.areas (parent_id);
create index areas_geom_idx on public.areas using gist (geom);

-- Per-user settings (what counts).
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  count_paths boolean not null default false,
  count_car boolean not null default false,
  updated_at timestamptz not null default now()
);

-- One recorded outing. The id is created on the device so uploads can repeat safely.
create table public.tracks (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  mode text not null check (mode in ('foot', 'bike', 'car', 'mixed')),
  distance_m double precision not null default 0 check (distance_m >= 0),
  file_key text,
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);
create index tracks_user_started_idx on public.tracks (user_id, started_at desc);

-- Coverage cells (H3) a user has touched, one compact block per map tile.
create table public.user_tile_coverage (
  user_id uuid not null references auth.users (id) on delete cascade,
  tile_id text not null,
  cells bytea not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, tile_id)
);

-- Cached progress per area, recomputed from coverage when street data or rules change.
create table public.user_area_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  area_id bigint not null references public.areas (id) on delete cascade,
  seen_m double precision not null default 0 check (seen_m >= 0),
  streets_complete integer not null default 0 check (streets_complete >= 0),
  data_version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, area_id)
);
create index user_area_progress_area_id_idx on public.user_area_progress (area_id);

-- Areas hidden on shared images (e.g. around home).
create table public.privacy_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,
  center extensions.geography(Point, 4326) not null,
  radius_m integer not null check (radius_m between 50 and 2000),
  created_at timestamptz not null default now()
);
create index privacy_zones_user_id_idx on public.privacy_zones (user_id);

-- Row level security
alter table public.areas enable row level security;
alter table public.user_settings enable row level security;
alter table public.tracks enable row level security;
alter table public.user_tile_coverage enable row level security;
alter table public.user_area_progress enable row level security;
alter table public.privacy_zones enable row level security;

-- Areas: everyone signed in may read, nobody may write through the API.
create policy areas_read on public.areas for select to authenticated using (true);

-- User tables: only your own rows.
create policy own_rows on public.user_settings for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.tracks for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.user_tile_coverage for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.user_area_progress for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_rows on public.privacy_zones for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Signed-out visitors get nothing.
revoke all on public.areas, public.user_settings, public.tracks, public.user_tile_coverage,
  public.user_area_progress, public.privacy_zones from anon;
