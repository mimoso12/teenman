import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {characterCount,insertEmoji,loadPostAuthors,postPresentation,publishComposedPost,validatePostFile,type FeedPost,type PostAttempt} from '../lib/post-composer';
import {filterEmojis} from '../lib/post-emojis';
const png=()=>new File([new Uint8Array([137,80,78,71,13,10,26,10,1])],'foto.png',{type:'image/png'});
test('contador Unicode e emojis preservam cursor/seleção e respeitam 500 caracteres',()=>{
 assert.equal(characterCount('A😀B'),3);assert.deepEqual(insertEmoji('antes depois','🎬',6,6),{text:'antes 🎬depois',cursor:8,allowed:true});assert.equal(insertEmoji('olá mundo','❤️',4,9).text,'olá ❤️');assert.equal(insertEmoji('a'.repeat(500),'🔥',500).allowed,false);
});
test('emojis filtram acentos e não renderizam valores arbitrários salvos como frequentes',()=>{
 assert.ok(filterEmojis('musica','pop',[]).some(item=>item.emoji==='🎵'));assert.deepEqual(filterEmojis('','frequent',['<script>','🔥']).map(v=>v.emoji),['🔥']);
});
test('validação de arquivo confere assinatura, formato e limites sem aceitar SVG/HTML renomeados',async()=>{
 assert.equal((await validatePostFile(png())).kind,'image');await assert.rejects(()=>validatePostFile(new File(['<html>'],'fake.png',{type:'image/png'})));await assert.rejects(()=>validatePostFile(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'})));await assert.rejects(()=>validatePostFile({type:'video/mp4',size:51*1024*1024,slice:()=>new Blob()}));
 const webm=new File([new Uint8Array([26,69,223,163])],'v.webm',{type:'video/webm'});assert.equal((await validatePostFile(webm)).kind,'video');
});
test('mídia explícita funciona sem extensão e mantém compatibilidade com posts antigos',()=>{
 assert.deepEqual(postPresentation({content:'olá',media_type:'video',media_url:'https://example.com/object/123'}),{text:'olá',media:{kind:'video',url:'https://example.com/object/123'}});assert.equal(postPresentation({content:'filme\nhttps://example.com/poster.jpg'}).media?.kind,'image');assert.equal(postPresentation({content:'seguro',media_type:'image',media_url:'javascript:alert(1)'}).media,null);
});
test('consulta secundária encontra avatar, nome e username sem depender da FK ou da coluna full_name',async()=>{
 const selects:string[]=[];const client={from:()=>({select:(columns:string)=>({in:async(_key:string,ids:string[])=>{selects.push(columns);assert.deepEqual(ids,['u1']);return columns.includes('full_name')?{error:{code:'42703'}}:{data:[{id:'u1',display_name:'Nome atualizado',avatar_url:'https://example.com/avatar.jpg',username:'nome'}]};}})})} as unknown as SupabaseClient;
 const authors=await loadPostAuthors(client,['u1','u1']);assert.equal(selects.length,2);assert.equal(authors.u1.name,'Nome atualizado');assert.equal(authors.u1.avatar,'https://example.com/avatar.jpg');assert.equal(authors.u1.username,'nome');
});
function fakeClient(banned=false){
 let row:FeedPost|null=null,fail=false;const calls={uploads:0,inserts:0};
 const client={auth:{getUser:async()=>({data:{user:{id:'owner',user_metadata:{display_name:'Nome do token'}}}})},from:(table:string)=>table==='profiles'?{select:()=>({eq:()=>({maybeSingle:async()=>({data:{is_banned:banned},error:null})})})}:({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})}),insert:(value:FeedPost)=>({select:()=>({single:async()=>{calls.inserts++;if(fail)return {error:{message:'network'}};row={...value,created_at:'2026-11-25T00:00:00Z'};return {data:row};}})})}),storage:{from:(bucket:string)=>({upload:async(path:string,_file:File,options:any)=>{assert.equal(bucket,'post-media');assert.match(path,/^owner\/.+\.png$/);assert.equal(options.upsert,false);calls.uploads++;return {error:null};},getPublicUrl:(path:string)=>({data:{publicUrl:'https://example.com/'+path}})})}} as unknown as SupabaseClient;
 return {client,calls,setFail:(value:boolean)=>fail=value};
}
test('publicação com mídia salva URL/tipo/etiqueta e usa o nome autenticado exigido pelo RLS',async()=>{
 const {client,calls}=fakeClient(),attempt:PostAttempt={id:'post-id'};const post=await publishComposedPost(client,{text:'',category:'cinema',file:png(),attempt});assert.equal(post.content,'');assert.equal(post.media_type,'image');assert.equal(post.category,'cinema');assert.equal(post.author_name,'Nome do token');assert.equal(calls.uploads,1);assert.ok(post.media_url);
});
test('repetir um post confirmado não duplica insert nem upload',async()=>{
 const {client,calls}=fakeClient(),attempt:PostAttempt={id:'post-id'},file=png();const input={text:'teste',category:'general' as const,file,attempt};await publishComposedPost(client,input);await publishComposedPost(client,input);assert.equal(calls.inserts,1);assert.equal(calls.uploads,1);
});
test('erro no insert mantém mídia já enviada para a próxima tentativa',async()=>{
 const fixture=fakeClient(),input={text:'rascunho',category:'music' as const,file:png(),attempt:{id:'post-id'} as PostAttempt};fixture.setFail(true);await assert.rejects(()=>publishComposedPost(fixture.client,input));assert.equal(fixture.calls.uploads,1);fixture.setFail(false);await publishComposedPost(fixture.client,input);assert.equal(fixture.calls.uploads,1);assert.equal(fixture.calls.inserts,2);
});
test('publicação vazia ou longa é bloqueada antes de qualquer upload',async()=>{
 const {client,calls}=fakeClient();for(const text of ['','a'.repeat(501)])await assert.rejects(()=>publishComposedPost(client,{text,category:'general',file:null,attempt:{id:'x'}}));assert.deepEqual(calls,{uploads:0,inserts:0});
});

test('conta banida não publica nem envia mídia ao Storage',async()=>{
 const {client,calls}=fakeClient(true);await assert.rejects(()=>publishComposedPost(client,{text:'Teste',category:'general',file:png(),attempt:{id:'post-id'}}),/impedida/);assert.deepEqual(calls,{uploads:0,inserts:0});
});
