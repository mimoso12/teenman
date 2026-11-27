-- Execute depois de schema.sql, social.sql e reposts.sql. Não remove notificações.
-- Disparos transacionais no banco + inserts de compatibilidade do aplicativo.
begin;
create table if not exists public.notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id) on delete cascade,
 type text not null check(type in ('like','repost','comment','follow')),
 post_id uuid references public.posts(id) on delete cascade,
 content_preview text not null default '',
 is_read boolean not null default false,
 created_at timestamptz not null default now(),
 check(actor_id<>user_id)
);
alter table public.notifications add column if not exists source_id uuid;
alter table public.notifications alter column is_read set default false;
create index if not exists teenman_notifications_unread on public.notifications(user_id,is_read,created_at desc);
create index if not exists teenman_notifications_timeline on public.notifications(user_id,created_at desc,id desc);
-- Se já houver duplicatas, interrompe sem apagar dados: revise-as antes de executar.
create unique index if not exists teenman_notifications_reaction on public.notifications(user_id,actor_id,type,post_id) where type in ('like','repost');
create unique index if not exists teenman_notifications_follow on public.notifications(user_id,actor_id) where type='follow';
create unique index if not exists teenman_notifications_comment on public.notifications(source_id) where type='comment' and source_id is not null;
alter table public.notifications enable row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select on public.notifications to authenticated;
grant insert(user_id,actor_id,type,post_id,content_preview,source_id) on public.notifications to authenticated;
grant update(is_read) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
do $$ declare p record;begin
 for p in select policyname from pg_policies where schemaname='public' and tablename='notifications' loop execute format('drop policy %I on public.notifications',p.policyname);end loop;
end $$;
create policy teenman_notifications_own_read on public.notifications for select to authenticated using((select auth.uid())=user_id);
create policy teenman_notifications_own_update on public.notifications for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy teenman_notifications_actor_remove on public.notifications for delete to authenticated using((select auth.uid())=actor_id);
create policy teenman_notifications_verified_insert on public.notifications for insert to authenticated with check(
 (select auth.uid())=actor_id and actor_id<>user_id and char_length(content_preview)<=240 and (
  (type='follow' and post_id is null and content_preview='' and exists(select 1 from public.follows f where f.follower_id=actor_id and f.following_id=user_id))
  or (type in ('like','repost','comment') and exists(select 1 from public.posts p where p.id=post_id and p.author_id=user_id) and (
   (type='like' and exists(select 1 from public.post_likes l where l.post_id=notifications.post_id and l.user_id=actor_id) and exists(select 1 from public.posts p where p.id=post_id and left(p.content,240)=content_preview))
   or (type='repost' and exists(select 1 from public.reposts r where r.post_id=notifications.post_id and r.user_id=actor_id) and exists(select 1 from public.posts p where p.id=post_id and left(p.content,240)=content_preview))
   or (type='comment' and exists(select 1 from public.post_comments c where c.id=source_id and c.post_id=notifications.post_id and c.author_id=actor_id and left(c.content,240)=content_preview))
  ))
 )
);
create schema if not exists teenman_private;
revoke all on schema teenman_private from public,anon,authenticated;
create or replace function teenman_private.social_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare payload jsonb;actor uuid;recipient uuid;target uuid;source uuid;kind text;preview text;
begin
 payload:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_TABLE_NAME='follows' then actor:=(payload->>'follower_id')::uuid;recipient:=(payload->>'following_id')::uuid;kind:='follow';preview:='';
 else
  target:=(payload->>'post_id')::uuid;
  select p.author_id,left(p.content,240) into recipient,preview from public.posts p where p.id=target;
  if TG_TABLE_NAME='post_comments' then actor:=(payload->>'author_id')::uuid;kind:='comment';source:=(payload->>'id')::uuid;preview:=left(payload->>'content',240);
  elsif TG_TABLE_NAME='reposts' then actor:=(payload->>'user_id')::uuid;kind:='repost';
  else actor:=(payload->>'user_id')::uuid;kind:='like';end if;
 end if;
 if recipient is null or actor is null or recipient=actor then return null;end if;
 if TG_OP='DELETE' then
  delete from public.notifications n where n.user_id=recipient and n.actor_id=actor and n.type=kind and n.post_id is not distinct from target and (kind<>'comment' or n.source_id=source);
 else
  insert into public.notifications(user_id,actor_id,type,post_id,content_preview,source_id) values(recipient,actor,kind,target,coalesce(preview,''),source) on conflict do nothing;
 end if;
 return null;
end $$;
revoke all on function teenman_private.social_notification() from public,anon,authenticated;
do $$ declare tbl text;begin
 foreach tbl in array array['post_likes','reposts','post_comments','follows'] loop
  if to_regclass('public.'||tbl) is null then raise exception 'Tabela public.% ausente: execute social.sql/reposts.sql antes.',tbl;end if;
  execute format('drop trigger if exists teenman_social_notification on public.%I',tbl);
  execute format('create trigger teenman_social_notification after insert or delete on public.%I for each row execute function teenman_private.social_notification()',tbl);
 end loop;
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime;end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then alter publication supabase_realtime add table public.notifications;end if;
end $$;
notify pgrst,'reload schema';
commit;
