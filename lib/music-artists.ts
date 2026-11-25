import {safeCover,validTrackId} from './vibe';
import type {CatalogTrack} from './music-catalog';
export type MusicArtist={id:string;name:string;image:string|null;genres:string[];followers:number|null;popularity:number|null};
export type ArtistDetails={artist:MusicArtist;tracks:CatalogTrack[];trackSource:'search'|'unavailable';biography:string|null;biographyUrl:string|null};
export function formatArtist(raw:any):MusicArtist|null{
 if(!raw||!validTrackId(raw.id)||typeof raw.name!=='string')return null;
 const number=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.floor(value):null;
 return {id:raw.id,name:raw.name.slice(0,200),image:safeCover(raw.images?.[0]?.url),genres:Array.isArray(raw.genres)?raw.genres.filter((g:unknown)=>typeof g==='string').slice(0,10).map((g:string)=>g.slice(0,80)):[],followers:number(raw.followers?.total),popularity:number(raw.popularity)};
}
export function artistPostContent(artist:MusicArtist){return `🎤 ${artist.name}\n${artist.genres.slice(0,3).join(' • ')}\nVamos conversar sobre suas músicas?\nhttps://open.spotify.com/artist/${artist.id}${artist.image?'\n'+artist.image:''}`.slice(0,1000);}
