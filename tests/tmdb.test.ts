import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatTmdbItem,moviePostContent,safeCatalogUrl} from '../lib/tmdb';
import {createTmdbService} from '../lib/tmdb-service';
import {splitPost} from '../lib/post-media';
test('normaliza séries, notas e imagens ausentes e exclui pessoas',()=>{
  assert.equal(formatTmdbItem({id:1,media_type:'person',name:'Pessoa'}),null);
  const item=formatTmdbItem({id:2,media_type:'tv',name:'Série',first_air_date:'2024-03-01',vote_average:8.456});
  assert.equal(item?.title,'Série');assert.equal(item?.year,'2024');assert.equal(item?.rating,'8.5');assert.equal(item?.posterUrl,null);
  assert.equal(formatTmdbItem({id:3,title:'Adulto',adult:true}),null);
});
test('publicação respeita o limite e mantém o pôster como mídia do feed',()=>{
  const movie=formatTmdbItem({id:1,title:'Um filme',poster_path:'/abc.jpg'})!;
  const content=moviePostContent(movie,'Opinião '.repeat(200));
  assert.ok(content.length<=1000);assert.equal(splitPost(content).media?.url,movie.posterUrl);
  assert.equal(safeCatalogUrl('javascript:alert(1)'),null);assert.equal(safeCatalogUrl('https://user:pass@example.com'),null);
});
test('usa endpoints oficiais, codifica busca e reutiliza requisições simultâneas',async()=>{
  const calls:URL[]=[];
  const service=createTmdbService({key:()=> 'private-test-key',fetcher:async(input)=>{calls.push(new URL(String(input)));return Response.json({results:[{id:1,title:'Filme'},{id:2,name:'Pessoa',media_type:'person'}],total_pages:2});}});
  const [a,b]=await Promise.all([service.get('ação & api_key=evil'),service.get('ação & api_key=evil')]);
  assert.deepEqual(a,b);assert.equal(calls.length,1);assert.equal(a.items.length,1);
  assert.equal(calls[0].hostname,'api.themoviedb.org');assert.equal(calls[0].pathname,'/3/search/multi');assert.equal(calls[0].searchParams.get('api_key'),'private-test-key');assert.equal(calls[0].searchParams.get('query'),'ação & api_key=evil');
  await service.get('ação & api_key=evil');assert.equal(calls.length,1);
  await service.get();assert.equal(calls[1].pathname,'/3/trending/movie/week');
});
test('falhas e configuração ausente nunca expõem a chave',async()=>{
  let requests=0;
  const missing=createTmdbService({key:()=>undefined,fetcher:async()=>{requests++;return Response.json({});}});
  await assert.rejects(missing.get(),/temporariamente/);assert.equal(requests,0);
  const failed=createTmdbService({key:()=> 'private-test-key',fetcher:async()=>{throw new Error('private-test-key');}});
  await assert.rejects(failed.get(),error=>error instanceof Error&&!error.message.includes('private-test-key'));
});

test('cache dura uma hora e o fetch usa revalidação sem no-store',async()=>{
  let time=0,calls=0;
  const service=createTmdbService({key:()=> 'test',now:()=>time,fetcher:async(_input,options)=>{calls++;assert.deepEqual((options as RequestInit & {next?:{revalidate:number}}).next,{revalidate:3600});assert.notEqual(options?.cache,'no-store');return Response.json({results:[],total_pages:1});}});
  await service.get();time=3599999;await service.get();assert.equal(calls,1);time=3600001;await service.get();assert.equal(calls,2);
});

test('rota responde 200 e arrays vazios em falha de chave ou rede',async()=>{
  const {createTmdbHandler}=await import('../lib/tmdb-http');
  for(const message of ['missing key','network timeout','upstream 401']){
    const response=await createTmdbHandler(async()=>{throw new Error(message);})(new Request('http://localhost/api/tmdb'));
    assert.equal(response.status,200);const body=await response.json();assert.deepEqual(body.results,[]);assert.deepEqual(body.items,[]);assert.equal(body.unavailable,true);assert.ok(!JSON.stringify(body).includes(message));
  }
});

test('filtros isolam os caches e usam search/person para atores',async()=>{
 const calls:string[]=[];const service=createTmdbService({key:()=> 'test',fetcher:async input=>{calls.push(new URL(String(input)).pathname);return Response.json({results:[{id:12,name:'Ator',profile_path:'/photo.jpg',media_type:'person'},{id:13,title:'Filme'}]});}});
 const all=await service.get('Nome',1,'all');assert.equal(all.people?.length,1);assert.equal(all.items.length,1);
 const actors=await service.get('Nome',1,'person');assert.equal(actors.items.length,0);assert.equal(actors.people?.[0].name,'Ator');
 await service.get('Nome',1,'movie');assert.deepEqual(calls,['/3/search/multi','/3/search/person','/3/search/movie']);
});

test('menção de ator mantém foto no formato de mídia do feed',async()=>{
 const {formatPerson,personPostContent}=await import('../lib/tmdb');
 const person=formatPerson({id:31,name:'Tom Hanks',profile_path:'/tom.jpg'})!;
 const content=personPostContent(person,'a'.repeat(2000));assert.ok(content.length<=1000);assert.equal(splitPost(content).media?.url,person.photoUrl);assert.ok(content.includes('https://www.themoviedb.org/person/31'));assert.equal(formatPerson({id:1,name:'Inválido',adult:true}),null);
});
