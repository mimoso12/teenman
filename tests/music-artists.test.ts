import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createArtistsService} from '../lib/spotify-artists-service';
import {formatArtist,artistPostContent} from '../lib/music-artists';
const id='A'.repeat(22),other='B'.repeat(22),trackId='C'.repeat(22);
const raw={id,name:'Banda & Voz',images:[{url:'https://i.scdn.co/image/abc'}],genres:['pop'],followers:{total:12345},popularity:70};
const track={id:trackId,name:'Canção',artists:[{id,name:raw.name}],album:{name:'Disco',images:[{url:'https://i.scdn.co/image/abc'}],release_date:'2025-01-01'}};
test('artista preserva seguidores zero e dados ausentes sem inventar métricas',()=>{
 assert.equal(formatArtist({...raw,followers:{total:0}})?.followers,0);
 assert.equal(formatArtist({id,name:'Nome'})?.followers,null);
 assert.equal(formatArtist({...raw,images:[{url:'javascript:alert(1)'}]})?.image,null);
 assert.equal(formatArtist({...raw,id:'../bad'}),null);
});
test('busca pagina até 18, codifica nome, compartilha cache e usa limites Dev Mode',async()=>{
 const calls:URL[]=[];let clock=0;
 const service=createArtistsService(async path=>{const url=new URL('https://api.spotify.com/v1/'+path);calls.push(url);const offset=Number(url.searchParams.get('offset'));return {artists:{items:Array.from({length:offset?8:10},(_,i)=>({...raw,id:String(i+offset).padStart(22,'0')}))}};},fetch,()=>clock);
 const [a,b]=await Promise.all([service.list('Voz & Banda'),service.list('Voz & Banda')]);assert.equal(a.length,18);assert.deepEqual(a,b);assert.equal(calls.length,2);assert.equal(calls[0].searchParams.get('q'),'Voz & Banda');assert.equal(calls[0].searchParams.get('limit'),'10');assert.equal(calls[1].searchParams.get('offset'),'10');
 await service.list('voz & banda');assert.equal(calls.length,2);clock=3600001;await service.list('voz & banda');assert.equal(calls.length,4);
});
test('detalhes usam busca com artista entre aspas, atribuem Wikipedia e deduplicam faixas',async()=>{
 const wikiCalls:string[]=[];
 const calls:string[]=[];
 const service=createArtistsService(async path=>{calls.push(path);return path.startsWith('search?')?{tracks:{items:[track,track]}}:raw;},async(input,options)=>{wikiCalls.push(String(input));assert.equal(options?.next?.revalidate,3600);return Response.json({title:raw.name,extract:'Banda musical brasileira.',description:'banda'});});
 const data=await service.details(id);assert.equal(data.tracks.length,1);assert.equal(data.tracks[0].cover,track.album.images[0].url);assert.equal(data.trackSource,'search');assert.equal(data.biography,'Banda musical brasileira.');assert.match(data.biographyUrl!,/^https:\/\/pt.wikipedia.org\/wiki\//);assert.ok(wikiCalls[0].endsWith(encodeURIComponent(raw.name)));
 assert.ok(calls.every(path=>!path.includes('top-tracks')));const query=new URL('https://api.spotify.com/'+calls.find(p=>p.startsWith('search?'))!).searchParams;assert.equal(query.get('q'),`artist:"${raw.name}"`);assert.equal(query.get('type'),'track');assert.equal(query.get('limit'),'10');assert.equal(query.get('market'),'BR');
});
test('busca exclui homônimos pelo ID',async()=>{
 const service=createArtistsService(async path=>{if(path.startsWith('search?'))return {tracks:{items:[track,{...track,id:other,artists:[{id:other,name:raw.name}]}]}};return raw;},async()=>new Response('',{status:404}));
 const data=await service.details(id);assert.equal(data.trackSource,'search');assert.deepEqual(data.tracks.map(t=>t.id),[trackId]);assert.equal(data.biography,null);
});
test('falhas parciais e desambiguação não derrubam perfil nem criam biografia falsa',async()=>{
 const service=createArtistsService(async path=>{if(path.startsWith('artists/'))return raw;throw new Error('network');},async()=>Response.json({type:'disambiguation',extract:'cantor ou outra pessoa'}));
 const data=await service.details(id);assert.equal(data.artist.name,raw.name);assert.equal(data.trackSource,'unavailable');assert.deepEqual(data.tracks,[]);assert.equal(data.biography,null);
 await assert.rejects(()=>service.details('../bad'));
});
test('busca vazia usa nome simples, ordena popularidade e deixa valores ausentes por último',async()=>{
 const queries:string[]=[];
 const service=createArtistsService(async path=>{if(path.startsWith('artists/'))return raw;const q=new URL('https://api.spotify.com/'+path).searchParams.get('q')!;queries.push(q);return {tracks:{items:q.startsWith('artist:')?[]:[track,{...track,id:'D'.repeat(22),popularity:5},{...track,id:'E'.repeat(22),popularity:90}]}};},async()=>new Response('',{status:404}));
 const data=await service.details(id);assert.deepEqual(queries,[`artist:"${raw.name}"`,raw.name]);assert.deepEqual(data.tracks.map(t=>t.popularity),[90,5,null]);
});
test('detalhes bloqueados preservam faixas e biografia usando nome enviado pelo card',async()=>{
 const service=createArtistsService(async path=>{if(path.startsWith('artists/'))throw new Error('403');return {tracks:{items:[track]}};},async()=>Response.json({extract:'Banda musical brasileira.'}));
 const data=await service.details(id,raw.name);assert.equal(data.artist.name,raw.name);assert.equal(data.tracks.length,1);assert.equal(data.biography,'Banda musical brasileira.');
});
test('detalhes bloqueados reutilizam o nome do catálogo sem depender do nome na URL',async()=>{
 const service=createArtistsService(async path=>{if(path.startsWith('artists/'))throw new Error('403');const type=new URL('https://api.spotify.com/'+path).searchParams.get('type');return type==='artist'?{artists:{items:[raw]}}:{tracks:{items:[track]}};},async()=>Response.json({extract:'Banda musical brasileira.'}));
 await service.list(raw.name);const data=await service.details(id);assert.equal(data.artist.name,raw.name);assert.equal(data.artist.image,raw.images[0].url);assert.equal(data.tracks.length,1);assert.ok(data.biography);
});
test('consulta direta recupera nome pelo oEmbed e falha total ainda mantém modal utilizável',async()=>{
 const service=createArtistsService(async path=>{if(path.startsWith('artists/'))throw new Error('403');return {tracks:{items:[track]}};},async input=>String(input).startsWith('https://open.spotify.com/oembed?')?Response.json({title:raw.name}):Response.json({extract:'Banda musical brasileira.'}));
 assert.equal((await service.details(id)).tracks.length,1);
 const failed=createArtistsService(async()=>{throw new Error('network');},async()=>{throw new Error('network');});const data=await failed.details(id);assert.deepEqual(data.tracks,[]);assert.equal(data.biography,null);assert.equal(data.artist.id,id);
});
test('post de artista mantém link e foto dentro do limite do feed',()=>{
 const content=artistPostContent(formatArtist(raw)!);assert.ok(content.length<=1000);assert.ok(content.includes('https://open.spotify.com/artist/'+id));assert.ok(content.endsWith(raw.images[0].url));
});
test('seleção inicial sem gêneros resolve nomes reais; busca vazia por nome não troca o resultado',async()=>{
 let calls=0;
 const service=createArtistsService(async path=>{calls++;const q=new URL('https://api.spotify.com/'+path).searchParams.get('q');return {artists:{items:q==='Anitta'?[{...raw,name:'Anitta'}]:[]}};});
 const artists=await service.list('');assert.equal(artists.length,1);assert.equal(artists[0].name,'Anitta');assert.equal(calls,7);
 const empty=await service.list('Nome inexistente');assert.deepEqual(empty,[]);assert.equal(calls,8);
});
