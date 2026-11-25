-- Execute completo no SQL Editor. Mantém perfis, faixas e publicações existentes.
begin;
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade);
alter table public.profiles
  add column if not exists display_name text not null default 'Membro Teenman',
  add column if not exists current_spotify_track_id text,
  add column if not exists current_track_name text,
  add column if not exists current_artist_name text,
  add column if not exists current_album_cover text,
  add column if not exists current_atmosphere text not null default 'normal',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists username text,
  add column if not exists bio text not null default '',
  add column if not exists category text not null default '',
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists current_ai_vibe jsonb;
create unique index if not exists teenman_profile_username_unique on public.profiles(username) where username is not null;
alter table public.profiles drop constraint if exists teenman_profile_details;
alter table public.profiles add constraint teenman_profile_details check (
  (username is null or username ~ '^[a-z0-9_]{3,24}$') and char_length(bio)<=300 and char_length(category)<=80
  and (avatar_url is null or (char_length(avatar_url)<=2048 and avatar_url like 'https://%'))
  and (banner_url is null or (char_length(banner_url)<=2048 and banner_url like 'https://%'))
  and (current_ai_vibe is null or jsonb_typeof(current_ai_vibe)='object')
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon,authenticated;
grant select(id,display_name,current_spotify_track_id,current_track_name,current_artist_name,current_album_cover,current_atmosphere,updated_at,username,bio,category,avatar_url,banner_url,created_at,current_ai_vibe) on public.profiles to anon,authenticated;
grant insert(id,display_name,current_spotify_track_id,current_track_name,current_artist_name,current_album_cover,current_atmosphere,username,bio,category,avatar_url,banner_url,current_ai_vibe) on public.profiles to authenticated;
grant update(id,display_name,current_spotify_track_id,current_track_name,current_artist_name,current_album_cover,current_atmosphere,username,bio,category,avatar_url,banner_url,current_ai_vibe) on public.profiles to authenticated;
drop policy if exists teenman_public_profiles on public.profiles;
drop policy if exists teenman_owner_insert on public.profiles;
drop policy if exists teenman_owner_update on public.profiles;
create policy teenman_public_profiles on public.profiles for select to anon,authenticated using(true);
create policy teenman_owner_insert on public.profiles for insert to authenticated with check((select auth.uid())=id);
create policy teenman_owner_update on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create or replace function public.teenman_profile_timestamp() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now();return new;end; $$;
drop trigger if exists teenman_profile_timestamp on public.profiles;
create trigger teenman_profile_timestamp before update on public.profiles for each row execute function public.teenman_profile_timestamp();
create or replace function public.teenman_sync_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name,created_at) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''),'Membro Teenman'),100),new.created_at)
  on conflict(id) do update set display_name=excluded.display_name;
  return new;
end; $$;
revoke all on function public.teenman_sync_auth_profile() from public;
drop trigger if exists teenman_auth_profile_sync on auth.users;
create trigger teenman_auth_profile_sync after insert or update of raw_user_meta_data on auth.users for each row execute function public.teenman_sync_auth_profile();
insert into public.profiles(id,display_name,created_at) select id,left(coalesce(nullif(trim(raw_user_meta_data->>'display_name'),''),'Membro Teenman'),100),created_at from auth.users on conflict(id) do nothing;
update public.profiles p set created_at=u.created_at from auth.users u where p.id=u.id and p.created_at<>u.created_at;

create table if not exists public.follows(follower_id uuid not null references auth.users(id) on delete cascade,following_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),primary key(follower_id,following_id),check(follower_id<>following_id));
create index if not exists teenman_followers_lookup on public.follows(following_id);
alter table public.follows enable row level security;
revoke all on public.follows from anon,authenticated;
grant select,insert,delete on public.follows to authenticated;
drop policy if exists owner_read on public.follows;
drop policy if exists owner_insert on public.follows;
drop policy if exists owner_delete on public.follows;
create policy owner_read on public.follows for select to authenticated using((select auth.uid())=follower_id);
create policy owner_insert on public.follows for insert to authenticated with check((select auth.uid())=follower_id);
create policy owner_delete on public.follows for delete to authenticated using((select auth.uid())=follower_id);
create or replace function public.profile_follow_counts(target_id uuid) returns table(following bigint,followers bigint) language sql stable security definer set search_path='' as $$
  select (select count(*) from public.follows where follower_id=target_id),(select count(*) from public.follows where following_id=target_id);
$$;
revoke all on function public.profile_follow_counts(uuid) from public;
grant execute on function public.profile_follow_counts(uuid) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('profile-media','profile-media',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists teenman_profile_upload on storage.objects;
drop policy if exists teenman_profile_update on storage.objects;
drop policy if exists teenman_profile_delete on storage.objects;
drop policy if exists teenman_profile_own_read on storage.objects;
create policy teenman_profile_upload on storage.objects for insert to authenticated with check(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy teenman_profile_update on storage.objects for update to authenticated using(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid()::text)) with check(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy teenman_profile_delete on storage.objects for delete to authenticated using(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy teenman_profile_own_read on storage.objects for select to authenticated using(bucket_id='profile-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then alter publication supabase_realtime add table public.profiles;end if;
end $$;
commit;
