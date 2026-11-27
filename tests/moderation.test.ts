import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {assertNotBanned, bannedMessage, submitReport} from '../lib/moderation';
import {createLiveToken} from '../lib/livekit-server';
const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',post='20000000-0000-4000-8000-000000000001',room='30000000-0000-4000-8000-000000000001';
test('somente banimento booleano confirmado bloqueia; falha de consulta assume false',async()=>{
 const client=(result:any)=>({from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>result})})})}) as any;
 await assert.rejects(()=>assertNotBanned(client({data:{is_banned:true}}),owner),new RegExp(bannedMessage));
 for(const result of [{error:{code:'42703'}},{error:{code:'network'}},{data:null},{data:{}},{data:{is_banned:false}},{data:{is_banned:null}},{data:{is_banned:'true'}}])await assert.doesNotReject(()=>assertNotBanned(client(result),owner));
 const offline={from:()=>{throw new Error('offline');}} as any;
 await assert.doesNotReject(()=>assertNotBanned(offline,owner));
 await assert.rejects(()=>createLiveToken(client({data:{is_banned:true}}),{id:owner} as any,room,{serverUrl:'wss://example.livekit.cloud',apiKey:'test',apiSecret:'test-only-secret'}),(error:any)=>error.status===403);
});
test('denúncia usa o autor autenticado e não inclui status controlado pelo usuário',async()=>{
 let saved:any;const client={auth:{getUser:async()=>({data:{user:{id:owner}}})},from:(table:string)=>{assert.equal(table,'reports');return {insert:async(value:any)=>{saved=value;return {error:null};}};}} as any;
 await submitReport(client,{id:post,targetType:'room',targetId:room,reason:'  Motivo real  '});
 assert.deepEqual(saved,{id:post,reporter_id:owner,target_type:'room',target_id:room,reason:'Motivo real'});
 await assert.rejects(()=>submitReport(client,{id:post,targetType:'post',targetId:post,reason:' '}));
});
test('Postgres: denúncias privadas, alvos reais e banimento não contornável por clientes',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table profiles(id uuid primary key,display_name text);create table posts(id uuid primary key,author_id uuid,content text);create table rooms(id uuid primary key,created_by uuid,name text);create table room_messages(id uuid primary key,room_id uuid,author_id uuid,content text);
 insert into auth.users values('${owner}'),('${other}');insert into profiles values('${owner}','Owner'),('${other}','Other');insert into posts values('${post}','${other}','Conteúdo real');insert into rooms values('${room}','${other}','Sala real');insert into room_messages values(gen_random_uuid(),'${room}','${other}','Mensagem real');
 grant select,insert,update,delete on profiles,posts,rooms,room_messages to authenticated;
 alter table profiles enable row level security;create policy profile_read on profiles for select to authenticated using(true);create policy profile_write on profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
 alter table posts enable row level security;create policy posts_read on posts for select to authenticated using(true);create policy posts_insert on posts for insert to authenticated with check(author_id=auth.uid());
 alter table rooms enable row level security;create policy rooms_all on rooms for all to authenticated using(true) with check(true);
 alter table room_messages enable row level security;create policy messages_all on room_messages for all to authenticated using(true) with check(true);`);
 const sql=readFileSync(new URL('../supabase/moderation.sql',import.meta.url),'utf8');await db.exec(sql);
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);insert into reports(reporter_id,target_type,target_id,reason) values('${owner}','post','${post}','Motivo do post'),('${owner}','room','${room}','Motivo da sala');`);
 assert.equal((await db.query('select * from reports')).rows.length,2);
 await assert.rejects(()=>db.exec(`insert into reports(reporter_id,target_type,target_id,reason) values('${other}','post','${post}','Falso autor')`),/row-level security/i);
 await assert.rejects(()=>db.exec(`insert into reports(reporter_id,target_type,target_id,reason) values('${owner}','post','${owner}','Alvo ausente')`),/row-level security/i);
 await assert.rejects(()=>db.exec(`update reports set status='reviewed'`),/permission denied/i);
 await assert.rejects(()=>db.exec(`update profiles set is_banned=true where id='${owner}'`),/Banimento/i);
 await db.exec(`select set_config('request.jwt.claim.sub','${other}',false)`);assert.equal((await db.query('select * from reports')).rows.length,0);
 await db.exec(`reset role;update profiles set is_banned=true where id='${owner}';set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false)`);
 assert.equal((await db.query<{banned:boolean}>('select is_current_user_banned() as banned')).rows[0].banned,true);
 await assert.rejects(()=>db.exec(`update profiles set is_banned=false where id='${owner}'`),/Banimento/i);
 await assert.rejects(()=>db.exec(`delete from profiles where id='${owner}'`),/banido/i);
 await assert.rejects(()=>db.exec(`insert into posts values(gen_random_uuid(),'${owner}','Bloqueado')`),/row-level security/i);
 await assert.rejects(()=>db.exec(`insert into rooms values(gen_random_uuid(),'${owner}','Bloqueada')`),/row-level security/i);
 await assert.rejects(()=>db.exec(`insert into room_messages values(gen_random_uuid(),'${room}','${owner}','Bloqueada')`),/row-level security/i);
 assert.equal((await db.query('select * from rooms')).rows.length,0);assert.equal((await db.query('select * from room_messages')).rows.length,0);
 assert.equal((await db.query('select * from posts')).rows.length,1,'banido ainda pode ler o feed');
 await db.exec(`reset role;delete from posts where id='${post}'`);assert.equal((await db.query('select * from reports')).rows.length,2,'relato é preservado após exclusão do alvo');
 await db.exec(sql);await db.exec('set role anon');await assert.rejects(()=>db.exec('select * from reports'),/permission denied/i);
 }finally{await db.close();}
});
