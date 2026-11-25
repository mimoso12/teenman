export type MovieItem={id:number;mediaType:'movie'|'tv';title:string;overview:string;rating:string;year:string;posterUrl:string|null;backdropUrl:string|null};
export type SearchFilter='all'|'movie'|'person';
export type PersonItem={id:number;name:string;photoUrl:string|null;character:string;knownFor:string};
export type MovieDetailsData={movie:MovieItem;cast:PersonItem[];directors:PersonItem[]};
export type PersonDetailsData={person:PersonItem;biography:string;movies:MovieItem[]};
export type TmdbPage={items:MovieItem[];people?:PersonItem[];query:string;page:number;totalPages:number};
export function formatPerson(raw:Record<string,unknown>):PersonItem|null{
  if(!raw||!Number.isSafeInteger(raw.id)||Number(raw.id)<=0||raw.adult||typeof raw.name!=='string'||!raw.name.trim())return null;
  return {id:Number(raw.id),name:raw.name.trim().slice(0,200),photoUrl:tmdbImage(raw.profile_path,'w500'),character:typeof raw.character==='string'?raw.character.slice(0,200):'',knownFor:typeof raw.known_for_department==='string'?raw.known_for_department:''};
}
export function personPostContent(person:PersonItem,opinion:string){
  return `🎭 ${person.name}\n\n${(opinion.trim()||'Quais trabalhos dessa pessoa você recomenda?').slice(0,600)}\nhttps://www.themoviedb.org/person/${person.id}${person.photoUrl?'\n'+person.photoUrl:''}`;
}
type RawItem={id?:unknown;media_type?:unknown;title?:unknown;name?:unknown;overview?:unknown;vote_average?:unknown;release_date?:unknown;first_air_date?:unknown;poster_path?:unknown;backdrop_path?:unknown;adult?:boolean};
export function tmdbImage(path:unknown,size:'w500'|'w780'):string|null{
  return typeof path==='string'&&/^\/[a-zA-Z0-9_-]{1,180}\.(jpg|jpeg|png|webp)$/i.test(path)?`https://image.tmdb.org/t/p/${size}${path}`:null;
}
export function formatTmdbItem(raw:RawItem,defaultType:'movie'|'tv'='movie'):MovieItem|null{
  if(!raw||typeof raw!=='object')return null;
  if(!Number.isSafeInteger(raw.id)||Number(raw.id)<=0||raw.adult||raw.media_type==='person')return null;
  if(raw.media_type!==undefined&&!['movie','tv'].includes(String(raw.media_type)))return null;
  const title=typeof raw.title==='string'?raw.title:typeof raw.name==='string'?raw.name:'';
  if(!title.trim())return null;
  const date=typeof raw.release_date==='string'?raw.release_date:typeof raw.first_air_date==='string'?raw.first_air_date:'';
  const rating=typeof raw.vote_average==='number'&&Number.isFinite(raw.vote_average)?Math.max(0,Math.min(10,raw.vote_average)):0;
  return {id:Number(raw.id),mediaType:raw.media_type==='tv'?'tv':defaultType,title:title.trim().slice(0,200),overview:typeof raw.overview==='string'&&raw.overview.trim()?raw.overview.trim().slice(0,10000):'Sinopse em português ainda não disponível.',rating:rating.toFixed(1),year:/^\d{4}-\d{2}-\d{2}$/.test(date)?date.slice(0,4):'—',posterUrl:tmdbImage(raw.poster_path,'w500'),backdropUrl:tmdbImage(raw.backdrop_path,'w780')};
}
export function moviePostContent(movie:MovieItem,opinion:string):string{
  const heading=`${movie.mediaType==='tv'?'📺 Série':'🎬 Filme'}: ${movie.title}${movie.year==='—'?'':` (${movie.year})`}`;
  const suffix=movie.posterUrl?`\n${movie.posterUrl}`:'';
  const text=opinion.trim()||'Quem já assistiu? Vamos conversar sobre essa história.';
  const room=Math.max(0,1000-heading.length-suffix.length-2);
  return `${heading}\n\n${text.slice(0,Math.min(600,room))}${suffix}`;
}
export function safeCatalogUrl(value:string):string|null{
  try{const url=new URL(value.trim());return url.protocol==='https:'&&!url.username&&!url.password&&url.href.length<=2048?url.href:null;}catch{return null;}
}
