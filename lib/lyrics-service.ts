export type LyricContext={lyrics:string|null;status:'found'|'instrumental'|'unavailable';url:string|null};
const clean=(text:string)=>text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function matchingLyrics(raw:any,track:string,artist:string):LyricContext|null{
 if(!raw||typeof raw.trackName!=='string'||typeof raw.artistName!=='string')return null;
 const title=clean(track),name=clean(artist),candidate=clean(raw.artistName);
 if(clean(raw.trackName)!==title||!name||!(candidate===name||artist.split(/,|&| feat\.? /i).some(part=>{const normalized=clean(part);return normalized.length>=3&&candidate===normalized;})))return null;
 const url=Number.isSafeInteger(raw.id)&&raw.id>0?'https://lrclib.net/api/get/'+raw.id:null;
 if(raw.instrumental===true)return {lyrics:null,status:'instrumental',url};
 if(typeof raw.plainLyrics!=='string'||!raw.plainLyrics.trim())return null;
 return {lyrics:raw.plainLyrics.replace(/\r/g,'').trim().slice(0,1400),status:'found',url};
}
export function createLyricsService(fetcher=fetch,now=Date.now){
 const cache=new Map<string,{value:LyricContext;expires:number}>(),pending=new Map<string,Promise<LyricContext>>();let cooldown=0;
 async function find(track:string,artist:string):Promise<LyricContext>{
  const key=JSON.stringify([clean(track),clean(artist)]),empty:LyricContext={lyrics:null,status:'unavailable',url:null};const hit=cache.get(key);if(hit&&hit.expires>now())return hit.value;if(pending.has(key))return pending.get(key)!;
  const task=(async()=>{let value=empty;if(now()>=cooldown){const signal=AbortSignal.timeout(2500);const paths=['get?'+new URLSearchParams({artist_name:artist,track_name:track}),'search?'+new URLSearchParams({q:track+' '+artist})];for(const path of paths){try{const response=await fetcher('https://lrclib.net/api/'+path,{headers:{Accept:'application/json','User-Agent':'Teenman/0.1 (music art direction; https://github.com/mimoso12/teenman)'},cache:'no-store',signal});if(response.status===429||response.status===503){const retry=response.headers.get('retry-after');const seconds=Number(retry);const delay=Number.isFinite(seconds)&&seconds>0?seconds*1000:Math.max(1000,Date.parse(retry||'')-now()||60000);cooldown=now()+delay+Math.min(1000,delay*.1);break;}if(!response.ok)continue;const raw=await response.json();const match=(Array.isArray(raw)?raw:[raw]).slice(0,20).map(item=>matchingLyrics(item,track,artist)).find(Boolean);if(match){value=match;break;}}catch{if(signal.aborted)break;}}}
   if(cache.size>=256)cache.delete(cache.keys().next().value!);cache.set(key,{value,expires:now()+(value.status==='unavailable'?600000:86400000)});return value;})();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
 }
 return {find};
}
