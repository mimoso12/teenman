import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSpotifyCatalog} from '../lib/spotify-catalog-service';
import {formatCatalogTrack,musicPostContent} from '../lib/music-catalog';
import {splitPost} from '../lib/post-media';
const raw={id:'a'.repeat(22),name:'Música',artists:[{name:'Artista'}],album:{id:'b'.repeat(22),name:'Álbum',release_date:'2024-04-01',images:[{url:'https://i.scdn.co/image/abc'}]}};
test('enriquece faixas com gravadora, cacheia álbum e deduplica buscas simultâneas',async()=>{
 const calls:string[]=[];const service=createSpotifyCatalog(async path=>{calls.push(path);return path.startsWith('albums/')?{name:'Álbum completo',label:'Gravadora real',release_date:'2024',images:raw.album.images}:{tracks:{items:[raw,{...raw,id:'c'.repeat(22)}]}};});
 const [a,b]=await Promise.all([service.search('faixa'),service.search('faixa')]);assert.deepEqual(a,b);assert.equal(a[0].label,'Gravadora real');assert.equal(a[0].releaseYear,'2024');assert.equal(a[0].popularity,null);assert.equal(calls.length,2);await service.search('outra');assert.equal(calls.filter(path=>path.startsWith('albums/')).length,1);
});
test('falha de álbum mantém a faixa sem inventar gravadora',async()=>{
 const service=createSpotifyCatalog(async path=>{if(path.startsWith('albums/'))throw new Error('network');return {tracks:{items:[raw]}};});
 const tracks=await service.search('música');assert.equal(tracks.length,1);assert.equal(tracks[0].label,'Não informada pelo Spotify');assert.equal(tracks[0].albumName,'Álbum');
});
test('post inclui gravadora, link e imagem como mídia sem exceder o limite',()=>{
 const track=formatCatalogTrack(raw,{label:'Selo'})!;const text=musicPostContent(track,'Minha opinião');assert.ok(text.includes('Produtora / Gravadora: Selo'));assert.ok(text.includes('https://open.spotify.com/track/'));assert.ok(text.length<=1000);assert.equal(splitPost(text).media?.url,track.albumCover);
});
