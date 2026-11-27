import type {SupabaseClient} from '@supabase/supabase-js';
import {profileImage} from './profile';
import {splitPost,type Media} from './post-media';
import {assertNotBanned} from './moderation';
export const postCategories=[{id:'general',label:'Geral'},{id:'cinema',label:'🎬 Cinema & Séries'},{id:'music',label:'🎵 Música'},{id:'games',label:'🎮 Games'},{id:'books',label:'📚 Livros'},{id:'sports',label:'⚽ Esportes'},{id:'civic',label:'🏛️ Debate Cívico'}] as const;
export type PostCategory=typeof postCategories[number]['id'];
export type PostAuthor={id:string;name:string;username:string|null;avatar:string|null};
export type FeedPost={id:string;author_id:string;author_name:string;content:string;created_at:string;media_url?:string|null;media_type?:'image'|'video'|null;category?:PostCategory|null};
export function characterCount(text:string){return Array.from(text).length;}
export function insertEmoji(text:string,emoji:string,start:number,end=start){const next=text.slice(0,start)+emoji+text.slice(end);return {text:next,cursor:start+emoji.length,allowed:characterCount(next)<=500};}
export function postPresentation(post:Pick<FeedPost,'content'|'media_url'|'media_type'>){const legacy=splitPost(post.content);const url=profileImage(post.media_url);const attached:Media|null=url&&(post.media_type==='image'||post.media_type==='video')?{url,kind:post.media_type}:null;return {text:attached?(legacy.media?.url===url?legacy.text:post.content):legacy.text,media:attached||legacy.media};}
export function normalizeAuthor(row:any):PostAuthor{return {id:String(row.id),name:String(row.full_name||row.display_name||'Membro Teenman'),username:typeof row.username==='string'?row.username.replace(/^@/,''):null,avatar:profileImage(row.avatar_url)};}
export async function loadPostAuthors(client:SupabaseClient,ids:string[]):Promise<Record<string,PostAuthor>>{
 const unique=[...new Set(ids)].filter(Boolean);if(!unique.length)return {};
 // Posts reference auth.users, not profiles. A secondary query avoids relying on a FK join.
 for(const columns of ['id,avatar_url,full_name,display_name,username','id,avatar_url,display_name,username','id,avatar_url,full_name,username','id,display_name']){
  const result=await client.from('profiles').select(columns).in('id',unique);if(!result.error)return Object.fromEntries((result.data||[]).map((row:any)=>[row.id,normalizeAuthor(row)]));
 }
 return {};
}
const fileTypes:Record<string,{kind:'image'|'video';extension:string}>={'image/jpeg':{kind:'image',extension:'jpg'},'image/png':{kind:'image',extension:'png'},'image/webp':{kind:'image',extension:'webp'},'image/gif':{kind:'image',extension:'gif'},'image/avif':{kind:'image',extension:'avif'},'video/mp4':{kind:'video',extension:'mp4'},'video/webm':{kind:'video',extension:'webm'}};
export async function validatePostFile(file:Pick<File,'type'|'size'|'slice'>){
 const type=fileTypes[file.type];if(!type||file.size<=0)throw new Error('Escolha uma imagem JPG, PNG, WebP, GIF ou AVIF, ou um vídeo MP4/WebM.');
 if(file.size>(type.kind==='image'?10:50)*1024*1024)throw new Error(type.kind==='image'?'A imagem deve ter até 10 MB.':'O vídeo deve ter até 50 MB.');
 const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer()),ascii=new TextDecoder().decode(bytes);
 const signature=file.type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:file.type==='image/png'?bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10':file.type==='image/gif'?/^GIF8[79]a/.test(ascii):file.type==='image/webp'?ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP':file.type==='image/avif'?ascii.slice(4,8)==='ftyp'&&/avif|avis/.test(ascii.slice(8)):file.type==='video/webm'?bytes.slice(0,4).join(',')==='26,69,223,163':ascii.slice(4,8)==='ftyp'&&!/avif|avis/.test(ascii.slice(8));
 if(!signature)throw new Error('O conteúdo do arquivo não corresponde ao formato informado. Escolha outro arquivo.');return type;
}
export type PostAttempt={id:string;uploaded?:{file:File;path:string;url:string;kind:'image'|'video'}};
export async function publishComposedPost(client:SupabaseClient,input:{text:string;category:PostCategory;file:File|null;attempt:PostAttempt}){
 const text=input.text.trim();if(characterCount(input.text)>500||(!text&&!input.file))throw new Error('Escreva até 500 caracteres ou anexe uma mídia.');
 if(!postCategories.some(c=>c.id===input.category))throw new Error('Categoria inválida.');
 const auth=await client.auth.getUser(),user=auth.data.user;if(!user)throw new Error('Entre novamente para publicar.');
 await assertNotBanned(client,user.id);
 const existing=await client.from('posts').select('*').eq('id',input.attempt.id).eq('author_id',user.id).maybeSingle();if(existing.data)return existing.data as FeedPost;if(existing.error)throw new Error('Não foi possível confirmar a publicação. Seu rascunho foi mantido.');
 let media=input.file&&input.attempt.uploaded?.file===input.file?input.attempt.uploaded:null;
 if(input.file&&!media){
  const type=await validatePostFile(input.file),path=`${user.id}/${crypto.randomUUID()}.${type.extension}`;
  const upload=await client.storage.from('post-media').upload(path,input.file,{contentType:input.file.type,cacheControl:'3600',upsert:false});
  if(upload.error)throw new Error('Não foi possível enviar a mídia. Confira a configuração do bucket post-media e tente novamente; seu rascunho foi mantido.');
  const {data}=client.storage.from('post-media').getPublicUrl(path);media={file:input.file,path,url:data.publicUrl,kind:type.kind};input.attempt.uploaded=media;
 }
 const payload={id:input.attempt.id,author_id:user.id,author_name:String(user.user_metadata?.display_name||'Membro Teenman'),content:text,category:input.category,media_url:media?.url||null,media_type:media?.kind||null};
 const result=await client.from('posts').insert(payload).select('*').single();if(!result.error&&result.data)return result.data as FeedPost;
 // A network timeout may follow a successful insert. Verify the UUID before retrying.
 const confirmed=await client.from('posts').select('*').eq('id',input.attempt.id).eq('author_id',user.id).maybeSingle();if(confirmed.data)return confirmed.data as FeedPost;
 throw new Error('Não foi possível confirmar a publicação. Tente novamente; o texto e a mídia foram mantidos.');
}
