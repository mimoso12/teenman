-- Execute completo no SQL Editor. Não apaga perfis ou publicações.
begin;
create table if not exists public.catalog_editors(
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('admin','creator')),
  created_at timestamptz not null default now()
);
alter table public.catalog_editors enable row level security;
revoke all on public.catalog_editors from anon,authenticated;
grant select on public.catalog_editors to authenticated;
drop policy if exists own_catalog_role on public.catalog_editors;
create policy own_catalog_role on public.catalog_editors for select to authenticated using((select auth.uid())=user_id);

create table if not exists public.original_titles(
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 160),
  kind text not null check(kind in ('book','movie','series')),
  synopsis text not null check(char_length(trim(synopsis)) between 1 and 2000),
  cover_url text not null check(char_length(cover_url)<=2048 and cover_url like 'https://%'),
  link_url text not null check(char_length(link_url)<=2048 and link_url like 'https://%'),
  created_at timestamptz not null default now()
);
create index if not exists original_titles_created_idx on public.original_titles(created_at desc);
alter table public.original_titles enable row level security;
revoke all on public.original_titles from anon,authenticated;
grant select on public.original_titles to anon,authenticated;
grant insert,update,delete on public.original_titles to authenticated;
drop policy if exists public_original_titles on public.original_titles;
drop policy if exists creator_add_original on public.original_titles;
drop policy if exists creator_edit_original on public.original_titles;
drop policy if exists creator_remove_original on public.original_titles;
create policy public_original_titles on public.original_titles for select to anon,authenticated using(true);
create policy creator_add_original on public.original_titles for insert to authenticated with check(
  creator_id=(select auth.uid()) and exists(select 1 from public.catalog_editors where user_id=(select auth.uid()) and role in ('admin','creator'))
);
create policy creator_edit_original on public.original_titles for update to authenticated using(
  exists(select 1 from public.catalog_editors where user_id=(select auth.uid()) and (role='admin' or (role='creator' and creator_id=(select auth.uid()))))
) with check(
  exists(select 1 from public.catalog_editors where user_id=(select auth.uid()) and (role='admin' or (role='creator' and creator_id=(select auth.uid()))))
);
create policy creator_remove_original on public.original_titles for delete to authenticated using(
  exists(select 1 from public.catalog_editors where user_id=(select auth.uid()) and (role='admin' or (role='creator' and creator_id=(select auth.uid()))))
);
commit;

-- Depois, o administrador do projeto pode autorizar uma conta existente:
-- insert into public.catalog_editors(user_id,role)
-- values ('UUID_DA_CONTA_EM_AUTHENTICATION_USERS','admin')
-- on conflict(user_id) do update set role=excluded.role;
-- Para autorizar um criador sem dar acesso global, use 'creator' no lugar de 'admin'.
-- Usuários comuns NÃO conseguem conceder o próprio papel pela aplicação.
