-- ============================================================
-- DriversLog - DEV Setup
-- Fuehre dieses Script im Supabase SQL Editor aus:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- Cars-Tabelle erstellen (ohne FK auf profiles fuer Dev)
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

-- RLS deaktivieren fuer Entwicklung (spaeter wieder aktivieren!)
alter table public.cars disable row level security;

-- Index fuer Performance
create index if not exists idx_cars_user_id on public.cars(user_id);
