-- Atualização para um Teenman que já tem public.posts (schema.sql).
-- Execute o arquivo completo no SQL Editor. Pode ser executado novamente.
-- Não remove posts, usuários ou mensagens existentes.
begin;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.post_reposts (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);
create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  content text not null check (char_length(trim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments(post_id, created_at);
create index if not exists room_messages_room_idx on public.room_messages(room_id, created_at desc);

-- Reações: só o dono pode inserir/remover. Nomes devem ser do token autenticado.
do $$
declare target text;
begin
  foreach target in array array['post_likes','post_reposts'] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on public.%I from anon, authenticated', target);
    execute format('grant select, insert, delete on public.%I to authenticated', target);
    execute format('drop policy if exists member_read on public.%I', target);
    execute format('drop policy if exists owner_insert on public.%I', target);
    execute format('drop policy if exists owner_delete on public.%I', target);
    execute format('create policy member_read on public.%I for select to authenticated using (true)', target);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id and author_name = coalesce((select auth.jwt() -> ''user_metadata'' ->> ''display_name''), ''Membro Teenman''))', target);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', target);
  end loop;
end $$;

alter table public.post_comments enable row level security;
revoke all on public.post_comments from anon, authenticated;
grant select, insert, delete on public.post_comments to authenticated;
drop policy if exists member_read on public.post_comments;
drop policy if exists owner_insert on public.post_comments;
drop policy if exists owner_delete on public.post_comments;
create policy member_read on public.post_comments for select to authenticated using (true);
create policy owner_insert on public.post_comments for insert to authenticated with check (
  (select auth.uid()) = author_id and author_name = coalesce((select auth.jwt() -> 'user_metadata' ->> 'display_name'), 'Membro Teenman')
);
create policy owner_delete on public.post_comments for delete to authenticated using ((select auth.uid()) = author_id);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select, insert, delete on public.follows to authenticated;
drop policy if exists owner_read on public.follows;
drop policy if exists owner_insert on public.follows;
drop policy if exists owner_delete on public.follows;
create policy owner_read on public.follows for select to authenticated using ((select auth.uid()) = follower_id);
create policy owner_insert on public.follows for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy owner_delete on public.follows for delete to authenticated using ((select auth.uid()) = follower_id);

alter table public.rooms enable row level security;
revoke all on public.rooms from anon, authenticated;
grant select, insert, delete on public.rooms to authenticated;
drop policy if exists member_read on public.rooms;
drop policy if exists owner_insert on public.rooms;
drop policy if exists owner_delete on public.rooms;
create policy member_read on public.rooms for select to authenticated using (true);
create policy owner_insert on public.rooms for insert to authenticated with check ((select auth.uid()) = created_by);
create policy owner_delete on public.rooms for delete to authenticated using ((select auth.uid()) = created_by);

alter table public.room_messages enable row level security;
revoke all on public.room_messages from anon, authenticated;
grant select, insert, delete on public.room_messages to authenticated;
drop policy if exists member_read on public.room_messages;
drop policy if exists owner_insert on public.room_messages;
drop policy if exists owner_delete on public.room_messages;
create policy member_read on public.room_messages for select to authenticated using (true);
create policy owner_insert on public.room_messages for insert to authenticated with check (
  (select auth.uid()) = author_id and author_name = coalesce((select auth.jwt() -> 'user_metadata' ->> 'display_name'), 'Membro Teenman')
);
create policy owner_delete on public.room_messages for delete to authenticated using ((select auth.uid()) = author_id);

-- Atualizações reais de posts, reações e chat, sem duplicar a publicação.
do $$
declare target text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach target in array array['posts','post_likes','post_reposts','post_comments','follows','rooms','room_messages'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = target) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end $$;
commit;
