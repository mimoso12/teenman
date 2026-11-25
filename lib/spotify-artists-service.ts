import {formatArtist,type MusicArtist,type ArtistDetails} from './music-artists';
import {formatCatalogTrack} from './music-catalog';
import {validTrackId} from './vibe';
export function createArtistsService(get:(path:string)=>Promise<any>,fetcher=fetch,now=Date.now){
 const cache=new Map<string,{data:any;until:number}>(),pending=new Map<string,Promise<any>>();
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
  const artists:MusicArtist[]=rows.map(formatArtist).filter((a:MusicArtist|null):a is MusicArtist=>Boolean(a));return [...new Map(artists.map(a=>[a.id,a])).values()].slice(0,18);
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
 async function details(id:string):Promise<ArtistDetails>{if(!validTrackId(id))throw new Error('invalid');return cached('artist:'+id,async()=>{
  const artistTask=get('artists/'+id);
  const topTask=get(`artists/${id}/top-tracks?market=BR`).then(value=>({ok:true as const,value})).catch(()=>({ok:false as const,value:null}));
  const raw=await artistTask,artist=formatArtist(raw);if(!artist)throw new Error('unavailable');
  const [top,bio]=await Promise.all([topTask,biography(artist.name)]);
  let rows=top.ok&&Array.isArray(top.value.tracks)?top.value.tracks:[],trackSource:ArtistDetails['trackSource']=rows.length?'top':'unavailable';
  if(!rows.length){try{const data=await get('search?'+new URLSearchParams({q:'artist:'+artist.name,type:'track',market:'BR',limit:'10'}));rows=Array.isArray(data.tracks?.items)?data.tracks.items:[];trackSource=rows.length?'search':'unavailable';}catch{}}
  rows=rows.filter((row:any)=>Array.isArray(row?.artists)&&row.artists.some((a:any)=>a?.id===id));
  const tracks=rows.map((row:any)=>formatCatalogTrack(row,null)).filter(Boolean);
  return {artist,tracks:[...new Map(tracks.map((t:any)=>[t.id,t])).values()] as ArtistDetails['tracks'],trackSource:tracks.length?trackSource:'unavailable',biography:bio?.text||null,biographyUrl:bio?.url||null};
 });}
 return {list,details};
}
