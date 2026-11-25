import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleBook,sportEvent,eventPost,shareContent} from '../lib/culture';
import {createBooksService} from '../lib/books-service';
import {createSportsService} from '../lib/sports-service';
import {parseNewsFeed,createNewsService} from '../lib/news-service';
import {createPublicSourceClient} from '../lib/public-source-client';
test('Google Books normaliza capas HTTPS, HTML e campos ausentes',()=>{
 const book=googleBook({id:'a',volumeInfo:{title:'Livro',description:'<b>Texto</b><script>bad()</script>',imageLinks:{thumbnail:'http://books.google.com/cover.jpg'}}})!;assert.equal(book.thumbnail,'https://books.google.com/cover.jpg');assert.equal(book.description,'Texto');assert.deepEqual(book.authors,[]);assert.equal(book.pageCount,null);
});
test('busca de livros usa Google Books sem chave com idioma e limite pedidos',async()=>{
 const service=createBooksService(async input=>{const u=new URL(String(input));assert.equal(u.hostname,'www.googleapis.com');assert.equal(u.searchParams.get('langRestrict'),'pt');assert.equal(u.searchParams.get('maxResults'),'18');assert.equal(u.searchParams.get('q'),'Duna');assert.equal(u.searchParams.has('key'),false);return Response.json({items:[{id:'1',volumeInfo:{title:'Duna'}}]});});assert.equal((await service.list('Duna')).source,'Google Books');
});
test('cota Google usa fallback identificado e cooldown para outras buscas',async()=>{
 let googleCalls=0;const service=createBooksService(async input=>{const u=new URL(String(input));if(u.hostname==='www.googleapis.com'){googleCalls++;return Response.json({}, {status:429});}assert.ok(u.searchParams.get('q')?.includes('language:por'));return Response.json({docs:[{key:'/works/OL1W',title:'Livro',cover_i:1}]});});const a=await service.list('subject:fiction');assert.equal(a.source,'Open Library');assert.equal(a.results.length,1);assert.ok(a.notice.includes('Google Books indisponível'));await service.list('Duna');assert.equal(googleCalls,1);
});
test('placar zero é preservado e agenda sem placar não vira zero a zero',()=>{
 const raw={idEvent:'1',strHomeTeam:'A',strAwayTeam:'B',dateEvent:'2026-11-25',strTime:'23:00:00'};const next=sportEvent(raw)!;assert.equal(next.homeScore,null);assert.equal(next.timestamp,'2026-11-25T23:00:00.000Z');assert.ok(!eventPost(next).includes('0 × 0'));const past=sportEvent({...raw,intHomeScore:'0',intAwayScore:'2'})!;assert.equal(past.homeScore,0);assert.ok(eventPost(past).includes('A 0 × 2 B'));
});
test('esportes preserva próximos jogos quando resultados recentes falham',async()=>{
 const service=createSportsService(async input=>{const url=String(input);if(url.includes('eventspastleague'))throw new Error('network');assert.ok(url.includes('id=4351'));return Response.json({events:[{idEvent:'2',strHomeTeam:'A',strAwayTeam:'B'}]});});const data=await service.get();assert.equal(data.next.length,1);assert.equal(data.past.length,0);assert.deepEqual(data.unavailable,['Resultados recentes']);
});
test('RSS extrai CDATA, imagem e data, remove HTML e bloqueia DTD/links executáveis',()=>{
 const source={name:'G1',url:'https://g1.globo.com/rss/g1/',domain:'globo.com'};const xml=`<rss><channel><item><title>Teste &amp; notícia</title><link>https://g1.globo.com/teste</link><description><![CDATA[<img src="http://s2.glbimg.com/a.jpg"/><p>Resumo <b>limpo</b></p>]]></description><pubDate>Tue, 24 Nov 2026 23:00:00 GMT</pubDate></item><item><title>Inválido</title><link>javascript:alert(1)</link></item></channel></rss>`;const rows=parseNewsFeed(xml,source);assert.equal(rows.length,1);assert.equal(rows[0].title,'Teste & notícia');assert.equal(rows[0].summary,'Resumo limpo');assert.equal(rows[0].image,'https://s2.glbimg.com/a.jpg');assert.equal(rows[0].publishedAt,'2026-11-24T23:00:00.000Z');assert.throws(()=>parseNewsFeed('<!DOCTYPE rss><rss/>',source));
});
test('cultura pop usa RSS alternativo explicitamente quando Omelete falha',async()=>{
 const service=createNewsService(async input=>String(input).includes('omelete')?new Response('404',{status:404}):new Response('<rss><channel><item><title>Filme</title><link>https://g1.globo.com/pop-arte/a</link></item></channel></rss>'));const data=await service.list('culture');assert.equal(data.results[0].source,'G1 • Pop & Arte');assert.deepEqual(data.unavailable,['RSS Omelete']);assert.ok(data.notice.includes('indisponível'));
});
test('cache compartilha requisições simultâneas e respeita revalidate',async()=>{
 let calls=0;const client=createPublicSourceClient(async(_input,options)=>{calls++;assert.deepEqual((options as RequestInit & {next:{revalidate:number}}).next,{revalidate:900});return Response.json({ok:true});});await Promise.all([client.get('https://example.com/rss',900),client.get('https://example.com/rss',900)]);assert.equal(calls,1);
});
test('compartilhamento de manchete preserva link sem copiar artigo inteiro',()=>{const text=shareContent('📰 Manchete','https://g1.globo.com/a','Fonte: G1. Vamos conversar.');assert.ok(text.includes('https://g1.globo.com/a'));assert.ok(text.length<=1000);});
