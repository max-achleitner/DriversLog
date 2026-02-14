-- ============================================================
-- DriversLog - DEV Setup
-- Fuehre dieses Script im Supabase SQL Editor aus:
-- https://supabase.com/dashboard → SQL Editor → New Query
--
-- WICHTIG: Nur fuer Entwicklung! Vor Production RLS wieder aktivieren.
-- ============================================================

-- ── Cars ──
create table if not exists public.cars (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null,
  make          text not null,
  model         text not null,
  year          smallint,
  modifications text,
  photo_url     text,
  created_at    timestamptz default now() not null
);

alter table public.cars disable row level security;
create index if not exists idx_cars_user_id on public.cars(user_id);

-- ── Routes ──
create table if not exists public.routes (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid not null,
  car_id           uuid references public.cars(id) on delete set null,
  title            text not null,
  description      text,
  distance_km      numeric(8, 2),
  duration_seconds integer,
  polyline_json    jsonb,
  is_public        boolean default false not null,
  created_at       timestamptz default now() not null
);

alter table public.routes disable row level security;
create index if not exists idx_routes_user_id on public.routes(user_id);
create index if not exists idx_routes_car_id on public.routes(car_id);

-- ── Waypoints ──
create table if not exists public.waypoints (
  id          uuid default gen_random_uuid() primary key,
  route_id    uuid references public.routes(id) on delete cascade not null,
  lat         double precision not null,
  lng         double precision not null,
  note        text,
  photo_url   text,
  type        text check (type in ('PHOTO_SPOT','FOOD','PARKING_SAFE','FUEL_HIGH_OCTANE','SOUND_TUNNEL','DRIVING_HIGHLIGHT')),
  rating      smallint check (rating >= 1 and rating <= 5),
  media_url   text,
  description text,
  tags        text[],
  sort_order  integer default 0 not null,
  created_at  timestamptz default now() not null
);

alter table public.waypoints disable row level security;
create index if not exists idx_waypoints_route on public.waypoints(route_id, sort_order);

-- ── Storage: Waypoint Photos ──
insert into storage.buckets (id, name, public)
values ('waypoint-photos', 'waypoint-photos', true)
on conflict (id) do nothing;

-- ── Profiles (optional fuer Dev) ──
create table if not exists public.profiles (
  id          uuid primary key,
  username    text unique not null,
  avatar_url  text,
  bio         text,
  created_at  timestamptz default now() not null
);

alter table public.profiles disable row level security;
