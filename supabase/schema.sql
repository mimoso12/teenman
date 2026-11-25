-- Execute uma vez no SQL Editor de um novo projeto Supabase.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index posts_created_at_idx on public.posts (created_at desc);
alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert, delete on public.posts to authenticated;
create policy "Leitura do feed publico" on public.posts for select using (true);
create policy "Publicar como usuario autenticado" on public.posts
  for insert to authenticated with check (
    (select auth.uid()) = author_id
    and author_name = (select auth.jwt() -> 'user_metadata' ->> 'display_name')
  );
create policy "Excluir apenas publicacoes proprias" on public.posts
  for delete to authenticated using ((select auth.uid()) = author_id);
