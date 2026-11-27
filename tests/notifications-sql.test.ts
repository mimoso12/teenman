import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const migration=readFileSync(new URL('../supabase/notifications.sql',import.meta.url),'utf8');
const receiver='10000000-0000-4000-8000-000000000001',actor='10000000-0000-4000-8000-000000000002',other='10000000-0000-4000-8000-000000000003',post='20000000-0000-4000-8000-000000000001';
test('Postgres real: triggers, deduplicação, RLS e permissões preservam a privacidade das notificações',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table public.posts(id uuid primary key,author_id uuid references auth.users(id),content text);
 create table public.post_likes(post_id uuid references posts(id) on delete cascade,user_id uuid references auth.users(id),primary key(post_id,user_id));
 create table public.reposts(post_id uuid references posts(id) on delete cascade,user_id uuid references auth.users(id),primary key(post_id,user_id));
 create table public.follows(follower_id uuid references auth.users(id),following_id uuid references auth.users(id),primary key(follower_id,following_id));
 create table public.post_comments(id uuid primary key,post_id uuid references posts(id) on delete cascade,author_id uuid references auth.users(id),content text);
 grant select,insert,delete on posts,post_likes,reposts,follows,post_comments to authenticated;
 insert into auth.users values('${receiver}'),('${actor}'),('${other}');insert into posts values('${post}','${receiver}','Texto real da publicação');`);
 await db.exec(migration);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${actor}',false);insert into post_likes values('${post}','${actor}');insert into reposts values('${post}','${actor}');insert into follows values('${actor}','${receiver}');insert into post_comments values('30000000-0000-4000-8000-000000000001','${post}','${actor}','Resposta'),('30000000-0000-4000-8000-000000000002','${post}','${actor}','Resposta');`);
 assert.equal((await db.query('select * from notifications')).rows.length,0,'ator não lê a caixa do destinatário');
 await assert.rejects(()=>db.exec(`insert into notifications(user_id,actor_id,type,post_id,content_preview) values('${other}','${actor}','like','${post}','Texto real da publicação')`),/row-level security/i);
 await assert.rejects(()=>db.exec(`insert into notifications(user_id,actor_id,type,post_id,content_preview) values('${receiver}','${other}','like','${post}','Texto real da publicação')`),/row-level security/i);
 await assert.rejects(()=>db.exec(`insert into notifications(user_id,actor_id,type,post_id,content_preview) values('${receiver}','${actor}','like','${post}','Texto real da publicação')`),/duplicate key/i);
 await assert.rejects(()=>db.exec(`select teenman_private.social_notification()`),/permission denied/i);
 await db.exec(`select set_config('request.jwt.claim.sub','${receiver}',false);insert into post_likes values('${post}','${receiver}');`);
 assert.equal((await db.query('select * from notifications')).rows.length,5,'sem auto-notificação; respostas iguais são eventos distintos');
 await db.exec(`update notifications set is_read=true where type='comment';`);
 assert.equal((await db.query('select * from notifications where is_read=false')).rows.length,3);
 await assert.rejects(()=>db.exec(`update notifications set actor_id='${other}'`),/permission denied/i);
 await db.exec(`select set_config('request.jwt.claim.sub','${other}',false);update notifications set is_read=true;`);
 assert.equal((await db.query('select * from notifications')).rows.length,0);
 await db.exec(`select set_config('request.jwt.claim.sub','${receiver}',false);`);assert.equal((await db.query('select * from notifications where is_read=false')).rows.length,3);
 await db.exec(`select set_config('request.jwt.claim.sub','${actor}',false);delete from post_likes where user_id='${actor}';`);
 await db.exec(`select set_config('request.jwt.claim.sub','${receiver}',false);`);assert.equal((await db.query("select * from notifications where type='like'")).rows.length,0);
 await db.exec('reset role;');await db.exec(migration);await db.exec(`set role anon;`);await assert.rejects(()=>db.exec('select * from notifications'),/permission denied/i);
 }finally{await db.close();}
});
