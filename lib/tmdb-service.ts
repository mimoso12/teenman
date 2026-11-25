import {formatTmdbItem,formatPerson,type SearchFilter,type TmdbPage} from './tmdb';
export class TmdbUnavailable extends Error{constructor(public status=503){super('Catálogo temporariamente indisponível. Tente novamente mais tarde.');}}
export function createTmdbService({key,fetcher=fetch,now=Date.now}:{key:()=>string|undefined;fetcher?:typeof fetch;now?:()=>number}){
  const cache=new Map<string,{page:TmdbPage;expires:number}>(),pending=new Map<string,Promise<TmdbPage>>();
  async function get(query='',page=1,filter:SearchFilter='all'):Promise<TmdbPage>{
    const normalized=query.trim();const name=JSON.stringify([normalized.toLocaleLowerCase('pt-BR'),page,filter]);
    const hit=cache.get(name);if(hit&&hit.expires>now())return hit.page;
    if(pending.has(name))return pending.get(name)!;
    const task=(async()=>{
      const apiKey=key();if(!apiKey)throw new TmdbUnavailable();
      const url=new URL(`https://api.themoviedb.org/3/${normalized?(filter==='person'?'search/person':filter==='movie'?'search/movie':'search/multi'):(filter==='person'?'person/popular':'trending/movie/week')}`);
      url.search=new URLSearchParams({api_key:apiKey,language:'pt-BR',include_adult:'false',page:String(page),...(normalized?{query:normalized}:{})}).toString();
      try{
        const response=await fetcher(url,{next:{revalidate:3600},signal:AbortSignal.timeout(8000)});
        if(!response.ok)throw new TmdbUnavailable(response.status===429?429:503);
        const data=await response.json();if(!Array.isArray(data.results))throw new TmdbUnavailable();
        const people=(filter==='movie'?[]:data.results.filter((row:any)=>row&&(filter==='person'||row.media_type==='person')).map(formatPerson).filter(Boolean));
        const items=(filter==='person'?[]:data.results).map((row:Parameters<typeof formatTmdbItem>[0])=>formatTmdbItem(row)).filter((item:unknown)=>Boolean(item));
        const result:TmdbPage={items,people,query:normalized,page,totalPages:Math.max(1,Math.min(500,Number(data.total_pages)||1))};
        if(cache.size>=100)cache.delete(cache.keys().next().value!);
        cache.set(name,{page:result,expires:now()+3600000});return result;
      }catch(error){if(error instanceof TmdbUnavailable)throw error;throw new TmdbUnavailable();}
    })();pending.set(name,task);try{return await task;}finally{pending.delete(name);}
  }
  return {get};
}
