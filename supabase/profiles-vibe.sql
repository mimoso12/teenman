-- Execute completo no SQL Editor do Supabase. Pode repetir sem apagar perfis.
begin;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);
alter table public.profiles
  add column if not exists display_name text not null default 'Membro Teenman',
  add column if not exists current_spotify_track_id text,
  add column if not exists current_track_name text,
  add column if not exists current_artist_name text,
  add column if not exists current_album_cover text,
  add column if not exists current_atmosphere text not null default 'normal',
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles drop constraint if exists teenman_vibe_track_id;
alter table public.profiles add constraint teenman_vibe_track_id check (current_spotify_track_id is null or current_spotify_track_id ~ '^[a-zA-Z0-9]{22}$');
alter table public.profiles drop constraint if exists teenman_vibe_atmosphere;
alter table public.profiles add constraint teenman_vibe_atmosphere check (current_atmosphere in ('normal','rain','neon','cinema'));
alter table public.profiles drop constraint if exists teenman_vibe_text_limits;
alter table public.profiles add constraint teenman_vibe_text_limits check (
  char_length(display_name) between 1 and 100
  and (current_track_name is null or char_length(current_track_name) <= 300)
  and (current_artist_name is null or char_length(current_artist_name) <= 500)
  and (current_album_cover is null or (char_length(current_album_cover) <= 1024 and current_album_cover ~ '^https://i\.scdn\.co/'))
);

-- A tabela pública não recebe e-mail, tokens ou segredos.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select (id,display_name,current_spotify_track_id,current_track_name,current_artist_name,current_album_cover,current_atmosphere,updated_at) on public.profiles to anon, authenticated;
grant insert (id,display_name,current_spotify_track_id,current_track_name,current_artist_name,current_album_cover,current_atmosphere) on public.profiles to authenticated;
grant update (id,display_name,current_spotify_track_id,current_track_name,current_artist_name,current_album_cover,current_atmosphere) on public.profiles to authenticated;
drop policy if exists teenman_public_profiles on public.profiles;
drop policy if exists teenman_owner_insert on public.profiles;
drop policy if exists teenman_owner_update on public.profiles;
create policy teenman_public_profiles on public.profiles for select to anon, authenticated using (true);
create policy teenman_owner_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy teenman_owner_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.teenman_profile_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists teenman_profile_timestamp on public.profiles;
create trigger teenman_profile_timestamp before update on public.profiles for each row execute function public.teenman_profile_timestamp();

create or replace function public.teenman_sync_auth_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id,display_name)
  values (new.id,left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'),''),'Membro Teenman'),100))
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;
revoke all on function public.teenman_sync_auth_profile() from public;
drop trigger if exists teenman_auth_profile_sync on auth.users;
create trigger teenman_auth_profile_sync after insert or update of raw_user_meta_data on auth.users for each row execute function public.teenman_sync_auth_profile();
insert into public.profiles (id,display_name)
select id,left(coalesce(nullif(trim(raw_user_meta_data ->> 'display_name'),''),'Membro Teenman'),100) from auth.users
on conflict (id) do nothing;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
commit;
