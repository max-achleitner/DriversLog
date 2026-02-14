-- ============================================================
-- DriversLog - Smart Stops Migration
-- Fuehre dieses Script im Supabase SQL Editor aus:
-- https://supabase.com/dashboard → SQL Editor → New Query
--
-- Erweitert bestehende waypoints-Tabelle um Smart-Stop Felder.
-- Kann sicher mehrfach ausgefuehrt werden (IF NOT EXISTS).
-- ============================================================

-- Neue Spalten hinzufuegen
alter table public.waypoints
  add column if not exists type text
    check (type in ('PHOTO_SPOT','FOOD','PARKING_SAFE','FUEL_HIGH_OCTANE','SOUND_TUNNEL','DRIVING_HIGHLIGHT'));

alter table public.waypoints
  add column if not exists rating smallint
    check (rating >= 1 and rating <= 5);

alter table public.waypoints
  add column if not exists media_url text;

alter table public.waypoints
  add column if not exists description text;

alter table public.waypoints
  add column if not exists tags text[];

-- Storage-Bucket fuer Waypoint-Fotos
insert into storage.buckets (id, name, public)
values ('waypoint-photos', 'waypoint-photos', true)
on conflict (id) do nothing;

-- Storage Policies (nur erstellen wenn sie noch nicht existieren)
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'waypoint_photos_insert' and tablename = 'objects'
  ) then
    create policy "waypoint_photos_insert"
      on storage.objects for insert
      with check (bucket_id = 'waypoint-photos' and auth.role() = 'authenticated');
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'waypoint_photos_select' and tablename = 'objects'
  ) then
    create policy "waypoint_photos_select"
      on storage.objects for select
      using (bucket_id = 'waypoint-photos');
  end if;

  if not exists (
    select 1 from pg_policies where policyname = 'waypoint_photos_delete' and tablename = 'objects'
  ) then
    create policy "waypoint_photos_delete"
      on storage.objects for delete
      using (bucket_id = 'waypoint-photos' and auth.uid()::text = (storage.foldername(name))[1]);
  end if;
end $$;
