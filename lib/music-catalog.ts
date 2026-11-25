import {safeCover,validTrackId,type Track} from './vibe';
export type CatalogTrack=Track & {albumName:string;albumCover:string|null;releaseYear:string;popularity:number|null;label:string};
export const musicCategories=[{id:'trending',name:'Em Alta',query:'year:2026'},{id:'brazil',name:'Brasil Hits',query:'sertanejo'},{id:'cinema',name:'Trilhas de Cinema',query:'soundtrack'},{id:'pop',name:'Pop & Internacional',query:'pop'},{id:'lofi',name:'Lo-Fi',query:'lofi chill'}] as const;
export type MusicCategory=typeof musicCategories[number]['id'];
export function formatCatalogTrack(raw:any,album:any):CatalogTrack|null{
  if(!raw||!validTrackId(raw.id)||typeof raw.name!=='string')return null;
  const cover=safeCover(album?.images?.[0]?.url||raw.album?.images?.[0]?.url);
  const date=album?.release_date||raw.album?.release_date||'';
  return {id:raw.id,name:raw.name.slice(0,200),artist:(Array.isArray(raw.artists)?raw.artists:[]).filter(Boolean).map((a:any)=>a.name).filter((name:any)=>typeof name==='string').join(', ').slice(0,250),cover,albumCover:cover,albumName:String(album?.name||raw.album?.name||'Álbum não informado').slice(0,200),releaseYear:/^\d{4}/.test(date)?date.slice(0,4):'—',popularity:typeof raw.popularity==='number'&&Number.isFinite(raw.popularity)?Math.max(0,Math.min(100,raw.popularity)):null,label:typeof album?.label==='string'&&album.label.trim()?album.label.trim().slice(0,250):'Não informada pelo Spotify'};
}
export function musicPostContent(track:CatalogTrack,opinion:string){
 const heading=`🎵 ${track.name.slice(0,150)} — ${track.artist.slice(0,150)}\nProdutora / Gravadora: ${track.label.slice(0,150)}`;
 const suffix=`\nhttps://open.spotify.com/track/${track.id}${track.albumCover?'\n'+track.albumCover:''}`;
 const room=Math.max(0,1000-heading.length-suffix.length-2);
 return heading+'\n\n'+opinion.trim().slice(0,Math.min(180,room))+suffix;
}
