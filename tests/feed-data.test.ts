import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {fetchFeedInteractions,loadPersonalizedFeed} from '../lib/feed-data';
import type {FeedPost} from '../lib/post-composer';
const post=(id:string,author_id:string):FeedPost=>({id,author_id,author_name:'Autor',content:'Post',created_at:id==='old'?'2020-01-01':'2026-11-25'});
function fixture(fail=false){
 const all=[post('recent','stranger'),post('friend-post','friend'),post('old','stranger'),post('interest','history-author')];const calls:{table:string;filter?:[string,string];inside?:[string,string[]]}[]=[];
 const client={from:(table:string)=>{
  let filter:[string,string]|undefined,inside:[string,string[]]|undefined;
  function resolve(){calls.push({table,filter,inside});if(fail&&table!=='posts')return {data:null,error:{code:'42501'}};
   if(table==='follows')return {data:[{following_id:'friend'}]};
   if(table==='reposts')return {data:filter?[]:[{post_id:'old',user_id:'friend',created_at:'2026-11-26'}]};
   if(table==='post_likes')return {data:filter?[{post_id:'interest'}]:[{post_id:'old',user_id:'viewer',author_name:'Viewer',created_at:'2026-11-25'}]};
   if(table==='post_comments')return {data:[]};
   return {data:inside?all.filter(post=>inside![1].includes(inside![0]==='id'?post.id:post.author_id)):[all[0]]};
  }
  const query={select:()=>query,eq:(field:string,value:string)=>{filter=[field,value];return query;},in:(field:string,ids:string[])=>{inside=[field,ids];return query;},order:()=>query,range:async()=>resolve(),limit:async()=>resolve(),then:(done:(value:ReturnType<typeof resolve>)=>unknown)=>Promise.resolve(resolve()).then(done)};return query;
 }} as unknown as SupabaseClient;return {client,calls};
}
test('carrega posts antigos republicados e histórico fora do feed sem misturar a autoria',async()=>{
 const {client,calls}=fixture();const result=await loadPersonalizedFeed(client,'viewer');assert.deepEqual(new Set(result.posts.map(p=>p.id)),new Set(['recent','friend-post','old']));assert.equal(result.posts.find(p=>p.id==='old')?.author_id,'stranger');assert.deepEqual(result.interactedPosts.map(p=>p.id),['interest']);assert.deepEqual(result.following,['friend']);assert.equal(result.followingReposts[0].post_id,'old');assert.ok(calls.some(call=>call.table==='reposts'&&call.inside?.[0]==='user_id'));assert.ok(calls.some(call=>call.table==='post_likes'&&call.filter?.[1]==='viewer'));
});
test('falhas das interações e de follows preservam os posts e sinalizam dados ausentes',async()=>{
 const {client}=fixture(true);const result=await loadPersonalizedFeed(client,'viewer');assert.equal(result.posts.length,1);assert.equal(result.socialReady,false);assert.ok(result.unavailable.includes('Curtidas'));assert.ok(result.unavailable.includes('Pessoas seguidas'));assert.deepEqual(result.likes,[]);
});
test('engajamento percorre páginas além do limite padrão do Supabase',async()=>{
 const offsets:number[]=[];const client={from:()=>({select:()=>({in:()=>({order:()=>({order:()=>({range:async(start:number)=>{offsets.push(start);return {data:Array.from({length:start===0?500:3},(_,i)=>({post_id:'p',user_id:String(start+i)}))};}})})})})})} as unknown as SupabaseClient;
 const result=await fetchFeedInteractions(client,'post_likes',['p']);assert.equal(result.length,503);assert.deepEqual(offsets,[0,500]);
});
