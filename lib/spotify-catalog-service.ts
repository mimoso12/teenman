import {formatCatalogTrack,type CatalogTrack} from './music-catalog';
export function createSpotifyCatalog(get:(path:string)=>Promise<any>,now=Date.now){
  const albums=new Map<string,{data:any;expires:number}>(),searches=new Map<string,{data:CatalogTrack[];expires:number}>(),pending=new Map<string,Promise<any>>();
  async function album(id:string){
    if(!/^[a-zA-Z0-9]{22}$/.test(id))return null;
    const hit=albums.get(id);if(hit&&hit.expires>now())return hit.data;
    const key='album:'+id;if(pending.has(key))return pending.get(key);
    const task=(async()=>{let data=null;try{data=await get(`albums/${id}?market=BR`);}catch{}if(albums.size>=200)albums.delete(albums.keys().next().value!);albums.set(id,{data,expires:now()+(data?3600000:60000)});return data;})();
    pending.set(key,task);try{return await task;}finally{pending.delete(key);}
  }
  async function search(query:string):Promise<CatalogTrack[]>{
    const key=query.trim().toLocaleLowerCase('pt-BR'),hit=searches.get(key);if(hit&&hit.expires>now())return hit.data;
    const name='search:'+key;if(pending.has(name))return pending.get(name);
    const task=(async()=>{
      const response=await get(`search?${new URLSearchParams({q:query.trim(),type:'track',limit:'10',market:'BR'})}`);
      if(!Array.isArray(response.tracks?.items))throw new Error('unavailable');
      const raw=response.tracks.items.filter(Boolean).slice(0,10),tracks:CatalogTrack[]=[];
      // Três chamadas simultâneas no máximo; álbuns compartilhados usam a mesma Promise.
      for(let start=0;start<raw.length;start+=3){const batch=await Promise.all(raw.slice(start,start+3).map(async(row:any)=>formatCatalogTrack(row,await album(row.album?.id||''))));tracks.push(...batch.filter((row):row is CatalogTrack=>Boolean(row)));}
      const unique=[...new Map(tracks.map(track=>[track.id,track])).values()];
      if(searches.size>=100)searches.delete(searches.keys().next().value!);searches.set(key,{data:unique,expires:now()+600000});return unique;
    })();pending.set(name,task);try{return await task;}finally{pending.delete(name);}
  }
  return {search};
}
