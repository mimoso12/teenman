import {formatCollection,type MusicCollection,type CollectionDetails} from './music-collections';
import {formatCatalogTrack,type CatalogTrack} from './music-catalog';
import {validTrackId} from './vibe';
export function createCollectionsService(get:(path:string)=>Promise<any>,now=Date.now){
 const cache=new Map<string,{value:any;expires:number}>(),pending=new Map<string,Promise<any>>();
 async function cached<T>(key:string,work:()=>Promise<T>):Promise<T>{const hit=cache.get(key);if(hit&&hit.expires>now())return hit.value;if(pending.has(key))return pending.get(key)!;const task=work().then(value=>{if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{value,expires:now()+3600000});return value;});pending.set(key,task);try{return await task;}finally{pending.delete(key);}}
 async function artistAlbums(id:string):Promise<MusicCollection[]>{if(!validTrackId(id))throw new Error('invalid');return cached('artist:'+id,async()=>{let rows:any[]=[];for(const [limit,offset] of [[10,0],[2,10]]){try{const data=await get(`artists/${id}/albums?include_groups=album,single&market=BR&limit=${limit}&offset=${offset}`);if(!Array.isArray(data.items))throw new Error('unavailable');rows.push(...data.items);if(!data.next)break;}catch(error){if(!rows.length)throw error;break;}}return [...new Map(rows.map((row:any)=>formatCollection(row,'album')).filter((album):album is MusicCollection=>Boolean(album)).map((album:MusicCollection)=>[album.id,album])).values()] as MusicCollection[];});}
 async function playlists(query:string):Promise<MusicCollection[]>{const q=query.trim()||'Top Brasil Hits';return cached('playlists:'+q.toLowerCase(),async()=>{let rows:any[]=[];for(const [limit,offset] of [[10,0],[6,10]]){try{const data=await get('search?'+new URLSearchParams({q,type:'playlist',limit:String(limit),offset:String(offset),market:'BR'}));if(!Array.isArray(data.playlists?.items))throw new Error('unavailable');rows.push(...data.playlists.items);if(!data.playlists.next&&data.playlists.items.length<limit)break;}catch(error){if(!rows.length)throw error;break;}}return [...new Map(rows.map(row=>formatCollection(row,'playlist')).filter((p):p is MusicCollection=>Boolean(p)).map(p=>[p.id,p])).values()].slice(0,16);});}
 async function details(kind:'album'|'playlist',id:string,offset=0):Promise<CollectionDetails>{if(!validTrackId(id)||!Number.isInteger(offset)||offset<0||offset>10000)throw new Error('invalid');return cached(`${kind}:${id}:${offset}`,async()=>{
  const resource=kind==='album'?'albums':'playlists';
  const [metadata,page]=await Promise.allSettled([get(`${resource}/${id}?market=BR`),get(`${resource}/${id}/${kind==='album'?'tracks':'items'}?market=BR&limit=10&offset=${offset}`)]);
  const raw=metadata.status==='fulfilled'?metadata.value:null;
  let listing=page.status==='fulfilled'?page.value:null;
  if(!listing&&offset===0){const embedded=kind==='album'?raw?.tracks:raw?.items||raw?.tracks;if(Array.isArray(embedded?.items))listing=embedded;}
  const collection=formatCollection(raw,kind)||formatCollection({id,name:kind==='album'?'Álbum no Spotify':'Playlist no Spotify'},kind)!;
  const tracks:CatalogTrack[]=(Array.isArray(listing?.items)?listing.items:[]).flatMap((entry:any)=>{const row=kind==='album'?entry:entry?.item??entry?.track;if(!row||entry?.is_local||row.is_local||row.type&&row.type!=='track'||row.is_playable===false)return [];const track=formatCatalogTrack(row,kind==='album'?raw:null);return track?[track]:[];});
  if(!raw&&!listing)throw new Error('restricted');
  return {collection,tracks,hasMore:Boolean(listing?.next),nextOffset:offset+(Array.isArray(listing?.items)?listing.items.length:0),restricted:!listing};
 });}
 return {artistAlbums,playlists,details};
}
