-- Republicações canônicas. Preserva as republicações antigas e todos os posts.
begin;
create table if not exists public.reposts (
 user_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid not null references public.posts(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,post_id)
);
create unique index if not exists teenman_reposts_unique on public.reposts(user_id,post_id);
create index if not exists teenman_reposts_profile_idx on public.reposts(user_id,created_at desc);
create index if not exists teenman_reposts_post_idx on public.reposts(post_id);
alter table public.reposts enable row level security;
grant select on public.reposts to anon,authenticated;
grant insert,delete on public.reposts to authenticated;
drop policy if exists teenman_repost_read on public.reposts;
create policy teenman_repost_read on public.reposts for select to anon,authenticated using(true);
drop policy if exists teenman_repost_insert on public.reposts;
create policy teenman_repost_insert on public.reposts for insert to authenticated with check((select auth.uid())=user_id);
drop policy if exists teenman_repost_delete on public.reposts;
create policy teenman_repost_delete on public.reposts for delete to authenticated using((select auth.uid())=user_id);
do $$ begin
 if to_regclass('public.post_reposts') is not null then
  insert into public.reposts(user_id,post_id,created_at) select user_id,post_id,created_at from public.post_reposts on conflict(user_id,post_id) do nothing;
 end if;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reposts') then alter publication supabase_realtime add table public.reposts;end if;
end $$;
commit;
