import {formatArtist,type MusicArtist,type ArtistDetails} from './music-artists';
import {formatCatalogTrack} from './music-catalog';
import type {CatalogTrack} from './music-catalog';
import {validTrackId} from './vibe';
import {createCollectionsService} from './spotify-collections-service';
export function createArtistsService(get:(path:string)=>Promise<any>,fetcher=fetch,now=Date.now){
 const collections=createCollectionsService(get,now);
 const cache=new Map<string,{data:any;until:number}>(),pending=new Map<string,Promise<any>>();
 const knownArtists=new Map<string,MusicArtist>();
 function remember(artist:MusicArtist){if(knownArtists.size>=200)knownArtists.delete(knownArtists.keys().next().value!);knownArtists.set(artist.id,artist);return artist;}
 async function cached<T>(key:string,work:()=>Promise<T>):Promise<T>{const hit=cache.get(key);if(hit&&hit.until>now())return hit.data;if(pending.has(key))return pending.get(key)!;const task=work().then(data=>{if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{data,until:now()+3600000});return data;});pending.set(key,task);try{return await task;}finally{pending.delete(key);}}
 async function list(query:string):Promise<MusicArtist[]>{return cached('search:'+query.trim().toLocaleLowerCase('pt-BR'),async()=>{
  const q=query.trim()||'genre:pop OR genre:brazilian';
  // Spotify Dev Mode limits each search page to 10; fetch 10 + 8 for 18 cards.
  const first=await get('search?'+new URLSearchParams({q,type:'artist',market:'BR',limit:'10',offset:'0'}));
  if(!Array.isArray(first.artists?.items))throw new Error('unavailable');
  let rows=first.artists.items;
  if(!query.trim()&&!rows.length){
   // Genre search may be empty in Dev Mode. Resolve a small editorial selection
   // by exact name, using real Spotify data rather than fabricated artist cards.
   const names=['Anitta','Ludmilla','Gilberto Gil','Taylor Swift','Coldplay','Bad Bunny'];
   for(let start=0;start<names.length;start+=3){const batch=await Promise.allSettled(names.slice(start,start+3).map(async name=>{
    const data=await get('search?'+new URLSearchParams({q:name,type:'artist',market:'BR',limit:'3'}));
    return (data.artists?.items||[]).find((row:any)=>typeof row?.name==='string'&&row.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
   }));rows.push(...batch.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value]:[]));}
  }
  if(rows.length===10){try{const next=await get('search?'+new URLSearchParams({q,type:'artist',market:'BR',limit:'8',offset:'10'}));rows=[...rows,...(next.artists?.items||[])];}catch{/* Preserve the first page if Spotify limits pagination. */}}
  const artists:MusicArtist[]=rows.map(formatArtist).filter((a:MusicArtist|null):a is MusicArtist=>Boolean(a));return [...new Map(artists.map(a=>[a.id,remember(a)])).values()].slice(0,18);
 });}
 async function summary(name:string){
  try{const response=await fetcher('https://pt.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(name),{headers:{Accept:'application/json','User-Agent':'Teenman/0.1 (artist biographies; https://github.com/mimoso12/teenman)'},next:{revalidate:3600},signal:AbortSignal.timeout(4500)});if(!response.ok)return null;const data=await response.json();
   // Do not use disambiguation pages or unrelated namesakes as an artist biography.
   if(data.type==='disambiguation'||typeof data.extract!=='string'||!/(cantor|cantora|banda|musical|músic|rapper|compositor|compositora|produtor|dupla|singer|disc.jockey)/i.test(data.description+' '+data.extract))return null;
   const title=typeof data.title==='string'?data.title:name;
   return {text:data.extract.slice(0,1200),url:'https://pt.wikipedia.org/wiki/'+encodeURIComponent(title)};
  }catch{return null;}
 }
 async function biography(name:string){
  const direct=await summary(name);if(direct)return direct;
  const alternatives=await Promise.all(['cantor','cantora','banda'].map(kind=>summary(`${name} (${kind})`)));
  return alternatives.find(Boolean)||null;
 }
 async function details(id:string,nameHint=''):Promise<ArtistDetails>{if(!validTrackId(id))throw new Error('invalid');const hint=nameHint.trim().slice(0,200);return cached('artist-search-v2:'+id+':'+hint.toLocaleLowerCase('pt-BR'),async()=>{
  let artist:MusicArtist|null=null;
  try{artist=formatArtist(await get('artists/'+id));if(artist)remember(artist);}catch{/* Search and Wikipedia must remain usable when artist details are restricted. */}
  artist??=knownArtists.get(id)||null;
  let name=artist?.name||hint;
  if(!name){try{const response=await fetcher('https://open.spotify.com/oembed?'+new URLSearchParams({url:'https://open.spotify.com/artist/'+id}),{next:{revalidate:3600},signal:AbortSignal.timeout(4500)});if(response.ok){const data=await response.json();if(typeof data.title==='string')name=data.title.trim().slice(0,200);}}catch{}}
  artist??=formatArtist({id,name:name||'Artista no Spotify'});
  const shown=artist!;
  async function searchTracks(){
   if(!name)return [];
   for(const q of [`artist:"${name.replace(/"/g,'')}"`,name]){
    try{const data=await get('search?'+new URLSearchParams({q,type:'track',market:'BR',limit:'10'}));
     const rows=Array.isArray(data.tracks?.items)?data.tracks.items:[];
     const tracks:CatalogTrack[]=rows.filter((row:any)=>Array.isArray(row?.artists)&&row.artists.some((a:any)=>a?.id===id)).map((row:any)=>formatCatalogTrack(row,null)).filter(Boolean);
     if(tracks.length)return [...new Map(tracks.map(track=>[track.id,track])).values()].sort((a,b)=>(b.popularity??-1)-(a.popularity??-1));
    }catch{/* Try the plain-name search if the filtered query is unavailable. */}
   }
   return [];
  }
  const [tracks,bio,albums]=await Promise.all([searchTracks(),name?biography(name):Promise.resolve(null),collections.artistAlbums(id).then(items=>({items,unavailable:false})).catch(()=>({items:[],unavailable:true}))]);
  return {artist:shown,tracks,trackSource:tracks.length?'search':'unavailable',biography:bio?.text||null,biographyUrl:bio?.url||null,albums:albums.items,albumsUnavailable:albums.unavailable};
 });}
 return {list,details};
}
