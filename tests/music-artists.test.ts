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
test('detalhes preservam top tracks, atribuem Wikipedia pt e deduplicam faixas',async()=>{
 const wikiCalls:string[]=[];
 const service=createArtistsService(async path=>path.includes('top-tracks')?{tracks:[track,track]}:raw,async(input,options)=>{wikiCalls.push(String(input));assert.equal(options?.next?.revalidate,3600);return Response.json({title:raw.name,extract:'Banda musical brasileira.',description:'banda'});});
 const data=await service.details(id);assert.equal(data.tracks.length,1);assert.equal(data.tracks[0].cover,track.album.images[0].url);assert.equal(data.trackSource,'top');assert.equal(data.biography,'Banda musical brasileira.');assert.match(data.biographyUrl!,/^https:\/\/pt.wikipedia.org\/wiki\//);assert.ok(wikiCalls[0].endsWith(encodeURIComponent(raw.name)));
});
test('top tracks removido usa busca e exclui homônimos pelo ID',async()=>{
 const service=createArtistsService(async path=>{if(path.includes('top-tracks'))throw new Error('403');if(path.startsWith('search?'))return {tracks:{items:[track,{...track,id:other,artists:[{id:other,name:raw.name}]}]}};return raw;},async()=>new Response('',{status:404}));
 const data=await service.details(id);assert.equal(data.trackSource,'search');assert.deepEqual(data.tracks.map(t=>t.id),[trackId]);assert.equal(data.biography,null);
});
test('falhas parciais e desambiguação não derrubam perfil nem criam biografia falsa',async()=>{
 const service=createArtistsService(async path=>{if(path.startsWith('artists/')&&!path.includes('top-tracks'))return raw;throw new Error('network');},async()=>Response.json({type:'disambiguation',extract:'cantor ou outra pessoa'}));
 const data=await service.details(id);assert.equal(data.artist.name,raw.name);assert.equal(data.trackSource,'unavailable');assert.deepEqual(data.tracks,[]);assert.equal(data.biography,null);
 await assert.rejects(()=>service.details('../bad'));
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
