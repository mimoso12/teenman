-- Execute no projeto covuebkkltmteqtopppa, depois de social.sql e profile-evolution.sql.
begin;
alter table public.profiles add column if not exists is_banned boolean not null default false;
update public.profiles set is_banned=false where is_banned is null;
alter table public.profiles alter column is_banned set default false;
alter table public.profiles alter column is_banned set not null;
grant select(is_banned) on public.profiles to authenticated;

-- Remains effective even if a legacy installation grants table-wide UPDATE.
create schema if not exists teenman_private;
revoke all on schema teenman_private from public,anon,authenticated;
create or replace function teenman_private.protect_ban_flag() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') then
  if TG_OP='INSERT' and new.is_banned=true then raise exception 'Banimento não pode ser alterado pelo usuário.' using errcode='42501';end if;
  if TG_OP='UPDATE' and new.is_banned is distinct from old.is_banned then raise exception 'Banimento não pode ser alterado pelo usuário.' using errcode='42501';end if;
  if TG_OP='DELETE' and old.is_banned=true then raise exception 'Perfil banido não pode ser removido pelo usuário.' using errcode='42501';end if;
 end if;
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
revoke all on function teenman_private.protect_ban_flag() from public,anon,authenticated;
drop trigger if exists teenman_protect_ban_flag on public.profiles;
create trigger teenman_protect_ban_flag before insert or update or delete on public.profiles for each row execute function teenman_private.protect_ban_flag();

create or replace function public.is_current_user_banned() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select p.is_banned from public.profiles p where p.id=(select auth.uid())),false)
$$;
revoke all on function public.is_current_user_banned() from public,anon;
grant execute on function public.is_current_user_banned() to authenticated;

-- Restrictive policies combine with existing ownership policies; no OR bypass.
do $$ declare tbl text;begin
 foreach tbl in array array['posts','post_comments','reposts','post_reposts'] loop
  if to_regclass('public.'||tbl) is not null then
   execute format('alter table public.%I enable row level security',tbl);
   execute format('drop policy if exists teenman_ban_publish on public.%I',tbl);
   execute format('create policy teenman_ban_publish on public.%I as restrictive for insert to authenticated with check(not (select public.is_current_user_banned()))',tbl);
   execute format('drop policy if exists teenman_ban_edit on public.%I',tbl);
   execute format('create policy teenman_ban_edit on public.%I as restrictive for update to authenticated using(not (select public.is_current_user_banned())) with check(not (select public.is_current_user_banned()))',tbl);
  end if;
 end loop;
 foreach tbl in array array['rooms','room_messages'] loop
  execute format('alter table public.%I enable row level security',tbl);
  execute format('drop policy if exists teenman_ban_rooms on public.%I',tbl);
  execute format('create policy teenman_ban_rooms on public.%I as restrictive for all to authenticated using(not (select public.is_current_user_banned())) with check(not (select public.is_current_user_banned()))',tbl);
 end loop;
end $$;

create table if not exists public.reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check(target_type in ('post','room')),
 target_id uuid not null,
 reason text not null check(char_length(trim(reason)) between 3 and 1000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now()
);
-- No target FK: reports remain available if the reported content is removed.
create index if not exists reports_owner on public.reports(reporter_id,created_at desc);
alter table public.reports enable row level security;
revoke all on public.reports from public,anon,authenticated;
grant select on public.reports to authenticated;
grant insert(id,reporter_id,target_type,target_id,reason) on public.reports to authenticated;
grant all on public.reports to service_role;
do $$ declare p record;begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='reports' loop execute format('drop policy %I on public.reports',p.policyname);end loop;
end $$;
drop policy if exists reports_own_read on public.reports;
drop policy if exists reports_verified_insert on public.reports;
create policy reports_own_read on public.reports for select to authenticated using((select auth.uid())=reporter_id);
create policy reports_verified_insert on public.reports for insert to authenticated with check(
 (select auth.uid())=reporter_id and (
 (target_type='post' and exists(select 1 from public.posts p where p.id=target_id))
 or (target_type='room' and exists(select 1 from public.rooms r where r.id=target_id))
 ));
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles') then alter publication supabase_realtime add table public.profiles;end if;
end $$;
notify pgrst,'reload schema';
commit;
