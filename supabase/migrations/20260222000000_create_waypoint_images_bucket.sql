-- ============================================================
-- Migration: Waypoint Images Storage + image_urls column
-- ============================================================

-- 1. Add image_urls array to waypoints table
alter table public.waypoints
  add column if not exists image_urls text[] default '{}';

-- 2. Create storage bucket for waypoint images
--    (separate from the existing waypoint-photos bucket in schema.sql)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'waypoint-images',
  'waypoint-images',
  true,
  5242880,  -- 5 MB limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- 3. RLS: Authenticated users can upload to their own subfolder only
--    Path structure: {userId}/{waypointId}/{filename}
create policy "waypoint_images_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'waypoint-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. RLS: Anyone can read images (public bucket, read-only)
create policy "waypoint_images_select"
  on storage.objects for select
  using (bucket_id = 'waypoint-images');

-- 5. RLS: Users can only delete files in their own subfolder
create policy "waypoint_images_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'waypoint-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
