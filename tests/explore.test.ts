import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {buildExploreTopics,explorePerson,searchPeople,searchTerm,topicMatches,saveExploreFollow} from '../lib/explore';
import type {FeedPost} from '../lib/post-composer';
const post=(id:string,content:string,category:FeedPost['category']='general'):FeedPost=>({id,content,category,author_id:'a',author_name:'Autor',created_at:'2026-11-25'});
test('hashtags contam posts distintos, unificam caixa/acentos e não contam repetição interna',()=>{
 const a=post('a','#Cinema #cinema #CÍNEMA');const topics=buildExploreTopics([a,a,post('b','#cinema')]);assert.equal(topics.find(t=>t.id==='hashtag:#cinema')?.count,2);
});
test('categorias e palavras contam publicações reais e descartam stopwords e URLs',()=>{
 const topics=buildExploreTopics([post('1','Cinema cinema incrível https://example.com/segredo','cinema'),post('2','Esse filme está incrível para todos'),post('3','Música hoje','music')]);assert.equal(topics.find(t=>t.id==='category:cinema')?.count,2);assert.equal(topics.find(t=>t.id==='word:incrivel')?.count,2);assert.ok(!topics.some(t=>['para','todos','example','segredo'].includes(t.value)));assert.ok(!topics.some(t=>t.value==='games'));
});
test('clicar em tópico usa a mesma regra que gerou sua contagem',()=>{
 const posts=[post('1','#Arte #Arte'),post('2','arte de desenhar'),post('3','Um filme no cinema')];for(const topic of buildExploreTopics(posts))assert.equal(posts.filter(p=>topicMatches(p,topic)).length,topic.count);assert.equal(posts.filter(p=>topicMatches(p,{id:'tag',name:'#Arte',kind:'hashtag',value:'#arte',count:1})).length,1);
});
test('perfil normaliza nome, handle, imagem segura e música sem expor campos extras',()=>{
 const person=explorePerson({id:'abc123',full_name:'Nome real',display_name:'Antigo',username:'@nome',bio:'Bio',avatar_url:'javascript:alert(1)',current_spotify_track_id:'A'.repeat(22),email:'private@example.com'});assert.equal(person.name,'Nome real');assert.equal(person.username,'@nome');assert.equal(person.listening,true);assert.equal(person.avatar,null);assert.ok(!('email' in person));
});
test('termo preserva username com underscore e não quebra a expressão de filtro PostgREST',()=>{assert.equal(searchTerm('@ana'), 'ana');assert.equal(searchTerm('@ana_castela'),'ana_castela');assert.ok(!/[(),%\\]/.test(searchTerm('ana%,id.eq.xyz_(test)')));});
test('busca pessoas tem fallback de esquema, exclui o usuário e pagina 18 + sentinela',async()=>{
 const ranges:unknown[]=[],filters:unknown[]=[];
 const client={from:()=>({select:(columns:string)=>{const query={neq:(key:string,value:string)=>{filters.push([key,value]);return query;},or:(filter:string)=>{filters.push(filter);return query;},order:()=>query,range:async(start:number,end:number)=>{ranges.push([start,end]);return columns.includes('full_name')?{error:{code:'42703'}}:{data:Array.from({length:19},(_,i)=>({id:'user'+i,display_name:'Nome',bio:'Cinema'}))};}};return query;}})} as unknown as SupabaseClient;
 const result=await searchPeople(client,'me','cinema',1);assert.equal(result.people.length,18);assert.equal(result.hasMore,true);assert.deepEqual(ranges,[[18,36],[18,36]]);assert.ok(filters.some(f=>JSON.stringify(f)==='["id","me"]'));assert.ok(filters.some(f=>typeof f==='string'&&f.includes('bio.ilike.%cinema%')));
});
test('seguir é autenticado e desfazer usa as duas colunas de follows',async()=>{
 const calls:unknown[]=[];const query={eq:(key:string,value:string)=>{calls.push([key,value]);return calls.length===2?Promise.resolve({error:null}):query;}};const client={auth:{getUser:async()=>({data:{user:{id:'me'}}})},from:(table:string)=>{assert.equal(table,'follows');return {insert:async(payload:unknown)=>{calls.push(payload);return {error:null};},delete:()=>query};}} as unknown as SupabaseClient;
 await saveExploreFollow(client,'me','other',false);assert.deepEqual(calls,[['follower_id','me'],['following_id','other']]);await assert.rejects(()=>saveExploreFollow(client,'me','me',true));await assert.rejects(()=>saveExploreFollow(client,'spoof','other',true));
});
