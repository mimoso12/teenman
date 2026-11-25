import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchReposts,mergeProfileTimeline,optimisticRepost,setRepost,loadProfileTimeline} from '../lib/reposts';
import type {FeedPost} from '../lib/post-composer';
const post=(id:string,created_at:string):FeedPost=>({id,created_at,content:'Post '+id,author_id:'author',author_name:'Autor',media_type:'image',media_url:'https://example.com/image.jpg'});
test('perfil combina originais e republicações pela data da atividade e remove duplicatas',()=>{
 const a=post('a','2026-01-01'),b=post('b','2026-01-02'),c=post('c','2026-01-03');
 const result=mergeProfileTimeline([a,c],[a,b],[{post_id:'a',user_id:'u',created_at:'2026-01-05'},{post_id:'b',user_id:'u',created_at:'2026-01-04'}]);
 assert.deepEqual(result.map(p=>p.id),['a','b','c']);assert.equal(result[0].repostedAt,'2026-01-05');assert.equal(result[0].author_name,'Autor');assert.equal(result[0].media_url,a.media_url);assert.equal(result[2].repostedAt,undefined);
});
test('estado otimista adiciona uma vez e remove somente a combinação usuário/post',()=>{
 const initial=[{post_id:'a',user_id:'other',created_at:'2026-01-01'}];const once=optimisticRepost(initial,'a','me',true);const twice=optimisticRepost(once,'a','me',true);assert.equal(twice.length,2);assert.equal(initial.length,1);assert.deepEqual(optimisticRepost(twice,'a','me',false),initial);
});
test('contadores percorrem todas as páginas sem truncar em 1.000 e deduplicam por usuário',async()=>{
 const ranges:number[]=[];const client={from:(table:string)=>{assert.equal(table,'reposts');return {select:()=>({in:()=>({order:()=>({order:()=>({range:async(start:number)=>{ranges.push(start);return {data:Array.from({length:start<1000?500:2},(_,i)=>({post_id:'a',user_id:'u'+(start+i),created_at:'2026-01-01'}))};}})})})})};}} as unknown as SupabaseClient;
 const result=await fetchReposts(client,['a','a']);assert.equal(result.length,1002);assert.deepEqual(ranges,[0,500,1000]);
});
test('insert usa tabela canônica e somente IDs do usuário autenticado',async()=>{
 let payload:unknown;const client={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:(table:string)=>{assert.equal(table,'reposts');return {insert:async(value:unknown)=>{payload=value;return {error:null};}};}} as unknown as SupabaseClient;
 await setRepost(client,'post','me',true);assert.deepEqual(payload,{post_id:'post',user_id:'me'});await assert.rejects(()=>setRepost(client,'post','other',true));
});
test('delete aplica as duas condições e insert duplicado é idempotente',async()=>{
 const conditions:unknown[]=[];const query={eq:(key:string,value:string)=>{conditions.push([key,value]);return conditions.length===2?Promise.resolve({error:null}):query;}};
 const client={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:()=>({delete:()=>query,insert:async()=>({error:{code:'23505'}})})} as unknown as SupabaseClient;
 await setRepost(client,'post','me',false);assert.deepEqual(conditions,[['post_id','post'],['user_id','me']]);await setRepost(client,'post','me',true);
});
test('aba dedicada busca post antigo por ID, ignora post excluído e preserva autor e mídia',async()=>{
 const lookups:unknown[]=[];
 const client={from:(table:string)=>({select:()=>{
  if(table==='reposts')return {eq:()=>({order:()=>({limit:async()=>({data:[{post_id:'old',user_id:'profile',created_at:'2026-06-01'},{post_id:'deleted',user_id:'profile',created_at:'2026-06-02'}]})})})};
  return {in:async(key:string,ids:string[])=>{lookups.push([key,ids]);return {data:[post('old','2020-01-01')]};}};
 }})} as unknown as SupabaseClient;
 const result=await loadProfileTimeline(client,'profile',true);assert.equal(result.length,1);assert.equal(result[0].timelineAt,'2026-06-01');assert.equal(result[0].author_name,'Autor');assert.deepEqual(lookups,[['id',['old','deleted']]]);
});
test('erros do banco são propagados para desfazer a atualização otimista',async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:()=>({insert:async()=>({error:{code:'42501'}})})} as unknown as SupabaseClient;
 await assert.rejects(()=>setRepost(client,'post','me',true),/Não foi possível/);
});
