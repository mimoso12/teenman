import test from 'node:test';
import assert from 'node:assert/strict';
import {createCollectionsService} from '../lib/spotify-collections-service';
import {createArtistsService} from '../lib/spotify-artists-service';
import {formatCollection} from '../lib/music-collections';
import {addTaste,inferGenres,parseTaste,tasteRecommendation,type TasteEntry} from '../lib/music-taste';
const id='A'.repeat(22),trackId='B'.repeat(22),artistId='C'.repeat(22),cover='https://i.scdn.co/image/album';
const album={id,name:'Disco completo',release_date:'2026-04-01',total_tracks:51,images:[{url:cover}],artists:[{id:artistId,name:'Artista'}]};
const track={id:trackId,name:'Faixa',type:'track',artists:[{id:artistId,name:'Artista'}]};
test('álbuns mantêm metadata e paginação na ordem original sem truncar a discografia',async()=>{
 const urls:string[]=[];const service=createCollectionsService(async path=>{urls.push(path);if(path.includes('/tracks?'))return {items:[track],next:path.includes('offset=0')?'next':null};return album;});
 const [one,again]=await Promise.all([service.details('album',id),service.details('album',id)]);assert.equal(urls.length,2);assert.deepEqual(one,again);assert.equal(one.tracks[0].cover,cover);assert.equal(one.tracks[0].albumName,album.name);assert.equal(one.hasMore,true);assert.equal(one.nextOffset,1);assert.equal((await service.details('album',id,1)).hasMore,false);assert.ok(urls.some(path=>path.includes('offset=1')));
});
test('playlists buscam 10 + 6 resultados, ignoram nulos e deduplicam',async()=>{
 const calls:URL[]=[];const service=createCollectionsService(async path=>{const url=new URL('https://api.spotify.com/v1/'+path);calls.push(url);return {playlists:{items:[null,album,{...album,id:'D'.repeat(22),owner:{display_name:'Criador'},description:'<b>Uma lista</b>'}],next:'more'}};});const rows=await service.playlists('Rock & Pop');assert.equal(rows.length,2);assert.equal(calls[0].searchParams.get('q'),'Rock & Pop');assert.equal(calls[0].searchParams.get('limit'),'10');assert.equal(calls[1].searchParams.get('offset'),'10');assert.equal(rows[1].description,'Uma lista');assert.equal(rows[1].creator,'Criador');
});
test('playlist aceita item/track, preserva sequência e descarta episódios, locais e indisponíveis',async()=>{
 const service=createCollectionsService(async path=>path.includes('/items?')?{items:[null,{item:null},{item:track},{track:{...track,id:'D'.repeat(22)}},{item:{...track,type:'episode'}},{is_local:true,track},{item:{...track,is_playable:false}}],next:null}:{...album,owner:{display_name:'Curador'}});
 const data=await service.details('playlist',id);assert.deepEqual(data.tracks.map(t=>t.id),[trackId,'D'.repeat(22)]);assert.equal(data.collection.creator,'Curador');assert.equal(data.restricted,false);
});
test('restrições não inventam faixas de playlist, preservam metadados e validam IDs/offsets',async()=>{
 const service=createCollectionsService(async path=>{if(path.includes('/items?'))throw new Error('403');return album;});const data=await service.details('playlist',id);assert.deepEqual(data.tracks,[]);assert.equal(data.restricted,true);assert.equal(data.collection.name,album.name);await assert.rejects(()=>service.details('album','../bad'));await assert.rejects(()=>service.details('album',id,-1));assert.equal(formatCollection({...album,images:[{url:'javascript:x'}]},'album')?.image,null);
});
test('falha em álbuns não remove as músicas ou a biografia do artista',async()=>{
 const service=createArtistsService(async path=>{if(path.includes('/albums?'))throw new Error('restricted');if(path.startsWith('artists/'))return {id:artistId,name:'Artista'};return {tracks:{items:[track]}};},async()=>Response.json({extract:'Uma banda musical.'}));const details=await service.details(artistId);assert.equal(details.albumsUnavailable,true);assert.deepEqual(details.albums,[]);assert.equal(details.tracks.length,1);assert.ok(details.biography);
});
test('discografia usa os grupos corretos e entrega álbuns ao perfil',async()=>{
 const calls:string[]=[];const service=createArtistsService(async path=>{calls.push(path);if(path.includes('/albums?'))return {items:[null,album,album]};if(path.startsWith('artists/'))return {id:artistId,name:'Artista'};return {tracks:{items:[]}};},async()=>new Response('',{status:404}));const details=await service.details(artistId);assert.equal(details.albums.length,1);assert.equal(details.albumsUnavailable,false);assert.ok(calls.some(p=>p.includes('include_groups=album,single&market=BR&limit=10')));
});
test('discografia entrega 12 álbuns com limites compatíveis e não perde a primeira página em falha parcial',async()=>{
 const calls:URL[]=[];const service=createCollectionsService(async path=>{const url=new URL('https://api.spotify.com/v1/'+path);calls.push(url);const offset=Number(url.searchParams.get('offset'));return {items:Array.from({length:offset?2:10},(_,i)=>({...album,id:String(i+offset).padStart(22,'0')})),next:offset?null:'next'};});assert.equal((await service.artistAlbums(artistId)).length,12);assert.deepEqual(calls.map(u=>u.searchParams.get('limit')),['10','2']);assert.equal(calls[1].searchParams.get('offset'),'10');
 const partial=createCollectionsService(async path=>{if(path.includes('offset=10'))throw new Error('quota');return {items:[album],next:'next'};});assert.equal((await partial.artistAlbums(artistId)).length,1);
});
test('gosto musical reconhece gêneros e nomes, limita histórico e ignora armazenamento inválido',()=>{
 const now=Date.now(),entry:TasteEntry={kind:'search',term:'Linkin Park',genres:[],at:now};assert.deepEqual(inferGenres(entry.term),['Rock']);assert.deepEqual(inferGenres('Nirvana'),['Rock']);assert.equal(tasteRecommendation([entry],now).genre,'Rock');assert.equal(tasteRecommendation([entry],now).queries[0],'genre:rock');assert.deepEqual(parseTaste([{...entry,at:Infinity},{...entry,term:2},entry],now),[entry]);assert.equal(addTaste([entry],{...entry,at:now+1000}).length,1);assert.equal(addTaste(Array(80).fill(entry),{...entry,term:'Rock',at:now+1000}).length,80);assert.deepEqual(addTaste([{...entry,kind:'artist'}],{...entry,kind:'artist',genres:['rock'],at:now+1000})[0].genres,['rock']);
 const recommendation=tasteRecommendation([{...entry,kind:'play',term:'Nirvana'}],now);assert.ok(recommendation.queries.includes('artist:"Nirvana"'));assert.equal(tasteRecommendation([],now).queries.length,0);
});
