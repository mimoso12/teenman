import {safeCover,validTrackId} from './vibe';
import type {CatalogTrack} from './music-catalog';
export type MusicCollection={id:string;name:string;image:string|null;year:string;total:number;description:string;creator:string};
export type CollectionDetails={collection:MusicCollection;tracks:CatalogTrack[];hasMore:boolean;nextOffset:number;restricted:boolean};
export function formatCollection(raw:any,kind:'album'|'playlist'):MusicCollection|null{
 if(!raw||!validTrackId(raw.id)||typeof raw.name!=='string')return null;
 const total=raw.total_tracks??raw.items?.total??raw.tracks?.total;
 return {id:raw.id,name:raw.name.slice(0,200),image:safeCover(raw.images?.[0]?.url),year:/^\d{4}/.test(raw.release_date||'')?raw.release_date.slice(0,4):'—',total:typeof total==='number'&&Number.isFinite(total)?Math.max(0,Math.floor(total)):0,description:typeof raw.description==='string'?raw.description.replace(/<[^>]*>/g,'').slice(0,1000):'',creator:kind==='playlist'?String(raw.owner?.display_name||'Criador no Spotify').slice(0,200):(raw.artists||[]).filter(Boolean).map((a:any)=>a.name).filter((n:any)=>typeof n==='string').join(', ').slice(0,250)};
}
