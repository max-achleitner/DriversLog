-- ============================================================
-- DriversLog - Supabase Schema
-- Fokus: Genussfahren & Community
-- ============================================================

-- 1. PROFILES
-- Erweitert auth.users mit oeffentlichen Profilinformationen
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  username    text unique not null,
  avatar_url  text,
  bio         text,
  created_at  timestamptz default now() not null
);

alter table public.profiles enable row level security;

-- Jeder kann oeffentliche Profile sehen
create policy "profiles_select_public"
  on public.profiles for select
  using (true);

-- Nutzer kann nur sein eigenes Profil bearbeiten
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles for delete
  using (auth.uid() = id);

-- Automatisch ein Profil anlegen, wenn sich ein User registriert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', 'user_' || left(new.id::text, 8)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. CARS
-- Fahrzeuge der Nutzer
-- ============================================================
create table public.cars (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  make          text not null,
  model         text not null,
  year          smallint,
  modifications text,
  photo_url     text,
  created_at    timestamptz default now() not null
);

alter table public.cars enable row level security;

-- Jeder kann Fahrzeuge sehen (Community-Gedanke)
create policy "cars_select_public"
  on public.cars for select
  using (true);

-- Nur eigene Fahrzeuge verwalten
create policy "cars_insert_own"
  on public.cars for insert
  with check (auth.uid() = user_id);

create policy "cars_update_own"
  on public.cars for update
  using (auth.uid() = user_id);

create policy "cars_delete_own"
  on public.cars for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 3. ROUTES
-- Gefahrene Strecken / Touren
-- ============================================================
create table public.routes (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references public.profiles(id) on delete cascade not null,
  car_id           uuid references public.cars(id) on delete set null,
  title            text not null,
  description      text,
  distance_km      numeric(8, 2),
  duration_seconds integer,
  polyline_json    jsonb,
  is_public        boolean default false not null,
  created_at       timestamptz default now() not null
);

alter table public.routes enable row level security;

-- Oeffentliche Routen kann jeder sehen, private nur der Besitzer
create policy "routes_select"
  on public.routes for select
  using (is_public or auth.uid() = user_id);

-- Nur eigene Routen verwalten
create policy "routes_insert_own"
  on public.routes for insert
  with check (auth.uid() = user_id);

create policy "routes_update_own"
  on public.routes for update
  using (auth.uid() = user_id);

create policy "routes_delete_own"
  on public.routes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 4. WAYPOINTS
-- Besondere Orte entlang einer Route
-- ============================================================
create table public.waypoints (
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

alter table public.waypoints enable row level security;

-- Waypoints erben die Sichtbarkeit ihrer Route
create policy "waypoints_select"
  on public.waypoints for select
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id
        and (r.is_public or auth.uid() = r.user_id)
    )
  );

-- Nur Waypoints eigener Routen verwalten
create policy "waypoints_insert_own"
  on public.waypoints for insert
  with check (
    exists (
      select 1 from public.routes r
      where r.id = route_id and auth.uid() = r.user_id
    )
  );

create policy "waypoints_update_own"
  on public.waypoints for update
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and auth.uid() = r.user_id
    )
  );

create policy "waypoints_delete_own"
  on public.waypoints for delete
  using (
    exists (
      select 1 from public.routes r
      where r.id = route_id and auth.uid() = r.user_id
    )
  );

-- ============================================================
-- 5. STORAGE — Waypoint Photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('waypoint-photos', 'waypoint-photos', true)
on conflict (id) do nothing;

-- Authentifizierte User duerfen Bilder hochladen
create policy "waypoint_photos_insert"
  on storage.objects for insert
  with check (bucket_id = 'waypoint-photos' and auth.role() = 'authenticated');

-- Jeder darf Bilder sehen (oeffentlicher Bucket)
create policy "waypoint_photos_select"
  on storage.objects for select
  using (bucket_id = 'waypoint-photos');

-- Nur eigene Dateien loeschen (Pfad beginnt mit user_id)
create policy "waypoint_photos_delete"
  on storage.objects for delete
  using (bucket_id = 'waypoint-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- INDEXES fuer Performance
-- ============================================================
create index idx_cars_user_id      on public.cars(user_id);
create index idx_routes_user_id    on public.routes(user_id);
create index idx_routes_car_id     on public.routes(car_id);
create index idx_routes_is_public  on public.routes(is_public) where is_public = true;
create index idx_waypoints_route   on public.waypoints(route_id, sort_order);
