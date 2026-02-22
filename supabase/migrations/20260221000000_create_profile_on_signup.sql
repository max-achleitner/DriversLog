-- ============================================================
-- Migration: Profil automatisch bei Registrierung anlegen
-- Datum: 2026-02-21
-- ============================================================
-- Hinweis: Diese Migration ist idempotent (create or replace /
-- create trigger if not exists) und kann sicher wiederholt werden.
-- Das Verhalten entspricht dem in schema.sql definierten Trigger.

-- Funktion: Legt ein Profil an, sobald ein neuer Auth-User erstellt wird.
-- Nutzt den Benutzernamen aus raw_user_meta_data, falls vorhanden,
-- sonst einen Fallback aus der E-Mail-Adresse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, created_at)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      'user_' || left(new.id::text, 8)
    ),
    now()
  );
  return new;
end;
$$;

-- Trigger loeschen falls er schon existiert (fuer saubere Neuerstellung)
drop trigger if exists on_auth_user_created on auth.users;

-- Trigger anlegen
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
