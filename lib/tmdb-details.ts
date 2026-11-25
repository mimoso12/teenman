import {formatTmdbItem,formatPerson,type MovieDetailsData,type PersonDetailsData} from './tmdb';
const cache=new Map<string,{value:unknown;expires:number}>(),pending=new Map<string,Promise<unknown>>();
async function resource(path:string,append:string):Promise<any>{
  const hit=cache.get(path);if(hit&&hit.expires>Date.now())return hit.value;
  if(pending.has(path))return pending.get(path);
  const task=(async()=>{
    const key=process.env.TMDB_API_KEY;if(!key)throw new Error('unavailable');
    const url=new URL(`https://api.themoviedb.org/3/${path}`);
    url.search=new URLSearchParams({api_key:key,language:'pt-BR',append_to_response:append}).toString();
    const response=await fetch(url,{next:{revalidate:3600},signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('unavailable');
    const data=await response.json();
    if(cache.size>=100)cache.delete(cache.keys().next().value!);
    cache.set(path,{value:data,expires:Date.now()+3600000});return data;
  })();pending.set(path,task);try{return await task;}finally{pending.delete(path);}
}
export async function movieDetails(id:number,type:'movie'|'tv'):Promise<MovieDetailsData>{
  const data=await resource(`${type}/${id}`,'credits');
  const movie=formatTmdbItem(data,type);if(!movie)throw new Error('unavailable');
  const cast=(Array.isArray(data.credits?.cast)?data.credits.cast:[]).slice().sort((a:any,b:any)=>(a.order||0)-(b.order||0)).map(formatPerson).filter(Boolean).slice(0,12);
  const crew=Array.isArray(data.credits?.crew)?data.credits.crew:[];
  const directors=crew.filter((row:any)=>row.job==='Director').map(formatPerson).filter(Boolean);
  return {movie,cast,directors};
}
export async function personDetails(id:number):Promise<PersonDetailsData>{
  const data=await resource(`person/${id}`,'movie_credits');
  const person=formatPerson(data);if(!person)throw new Error('unavailable');
  const seen=new Set<number>();
  const movies=(Array.isArray(data.movie_credits?.cast)?data.movie_credits.cast:[]).slice().sort((a:any,b:any)=>(Number(b.popularity)||0)-(Number(a.popularity)||0)).map((row:any)=>formatTmdbItem(row)).filter((row:any)=>{if(!row||seen.has(row.id))return false;seen.add(row.id);return true;}).slice(0,8);
  return {person,biography:typeof data.biography==='string'?data.biography.slice(0,15000):'',movies};
}
