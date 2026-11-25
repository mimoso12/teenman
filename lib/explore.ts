import type {SupabaseClient} from '@supabase/supabase-js';
import {profileImage} from './profile';
import {userHandle} from './post-media';
import type {FeedPost} from './post-composer';
export type ExplorePerson={id:string;name:string;username:string;bio:string;avatar:string|null;listening:boolean};
export type ExploreTopic={id:string;name:string;count:number;kind:'hashtag'|'word'|'category';value:string};
export const normalizeSearch=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function searchTerm(value:string){return value.trim().replace(/^@/,'').replace(/[^\p{L}\p{N}\s_#@'-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,120);}
export function explorePerson(row:any):ExplorePerson{const name=String(row.full_name||row.display_name||'Membro Teenman');return {id:row.id,name,username:row.username?'@'+String(row.username).replace(/^@/,''):userHandle(name,row.id),bio:typeof row.bio==='string'?row.bio:'',avatar:profileImage(row.avatar_url),listening:typeof row.current_spotify_track_id==='string'&&/^[a-zA-Z0-9]{22}$/.test(row.current_spotify_track_id)};}
export async function searchPeople(client:SupabaseClient,userId:string,query:string,page=0){
 const term=searchTerm(query);
 for(const fields of ['id,full_name,display_name,username,bio,avatar_url,current_spotify_track_id','id,display_name,username,bio,avatar_url,current_spotify_track_id','id,full_name,username,bio,avatar_url,current_spotify_track_id','id,display_name']){
  const columns=fields.split(','),names=['full_name','display_name','username','bio'].filter(column=>columns.includes(column));
  let request=client.from('profiles').select(fields).neq('id',userId);
  if(term)request=request.or(names.map(column=>`${column}.ilike.%${term.replace(/_/g,'\\_')}%`).join(','));
  const result=await request.order(columns.includes('display_name')?'display_name':'full_name').order('id').range(page*18,page*18+18);
  if(!result.error)return {people:(result.data||[]).slice(0,18).map(explorePerson),hasMore:(result.data||[]).length>18};
  if(!['42703','PGRST204','42501'].includes(result.error.code))throw new Error('Não foi possível buscar pessoas.');
 }
 throw new Error('Os perfis estão indisponíveis no momento.');
}
export async function searchExplorePosts(client:SupabaseClient,query:string){let request=client.from('posts').select('*').order('created_at',{ascending:false});const term=searchTerm(query);if(term)request=request.ilike('content',`%${term.replace(/_/g,'\\_')}%`);const result=await request.limit(term?100:300);if(result.error)throw new Error('Não foi possível buscar publicações.');return (result.data||[]) as FeedPost[];}
const categories=[{id:'cinema',name:'Cinema & Séries',words:/\b(cinema|filme|filmes|serie|series|trailer)\b/},{id:'music',name:'Música & Trilhas',words:/\b(musica|musicas|trilha|trilhas|cantor|cantora|banda|album|spotify)\b/},{id:'games',name:'Games',words:/\b(game|games|jogo|jogos|steam|playstation|xbox|nintendo)\b/},{id:'books',name:'Livros',words:/\b(livro|livros|leitura|escritor|escritora|manga)\b/},{id:'civic',name:'Debate Cívico',words:/\b(politica|debate|deputado|senado|prefeito|vereador|congresso)\b/},{id:'sports',name:'Esportes',words:/\b(esporte|esportes|futebol|basquete|formula|corrida|brasileirao)\b/}];
const stop=new Set('para como isso essa esse este esta aqui voce voces muito mais menos pelo pela pelos pelas sobre agora ainda porque quando onde qual quais tudo todos todas entre mesmo mesma depois antes tambem pode podem quero acho vamos hoje ontem amanha estou estamos esta estao tinha tenho temos seria sendo fazer feito mundo gente algo cada apenas compartilhe compartilhado ouvir tocar produtora gravadora informado informada spotify https http www com nao sim uma umas uns dos das que por nos nossa nosso suas seus seu sua meu minha meus minhas'.split(' '));
function words(text:string):string[]{return normalizeSearch(text.replace(/https?:\/\/\S+/g,' ').replace(/#[\p{L}\p{N}_]+/gu,' ')).match(/\p{L}[\p{L}\p{N}]{3,}/gu)||[];}
export function topicMatches(post:FeedPost,topic:ExploreTopic){const text=normalizeSearch(post.content);if(topic.kind==='category'){const category=categories.find(c=>c.id===topic.value);return post.category===topic.value||Boolean(category?.words.test(text));}if(topic.kind==='hashtag')return (post.content.match(/#[\p{L}\p{N}_]+/gu)||[]).some(tag=>normalizeSearch(tag)===topic.value);return words(post.content).includes(topic.value);}
export function buildExploreTopics(posts:FeedPost[]):ExploreTopic[]{const topics=new Map<string,ExploreTopic>();
 const add=(id:string,name:string,kind:ExploreTopic['kind'],value:string)=>{const topic=topics.get(id);if(topic)topic.count++;else topics.set(id,{id,name,kind,value,count:1});};
 for(const post of new Map(posts.map(p=>[p.id,p])).values()){
  const tags=new Map((post.content.match(/#[\p{L}\p{N}_]+/gu)||[]).map(tag=>[normalizeSearch(tag),tag]));for(const [tag,label] of tags)add('hashtag:'+tag,label,'hashtag',tag);
  const text=normalizeSearch(post.content);for(const category of categories)if(post.category===category.id||category.words.test(text))add('category:'+category.id,category.name,'category',category.id);
  for(const word of new Set(words(post.content)))if(!stop.has(word))add('word:'+word,word,'word',word);
 }
 return [...topics.values()].filter(t=>t.kind!=='word'||t.count>=2).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'pt-BR')).slice(0,24);
}
export async function saveExploreFollow(client:SupabaseClient,userId:string,targetId:string,following:boolean){if(userId===targetId)throw new Error('Este é o seu perfil.');const auth=await client.auth.getUser();if(auth.data.user?.id!==userId)throw new Error('Entre novamente para seguir pessoas.');const result=following?await client.from('follows').insert({follower_id:userId,following_id:targetId}):await client.from('follows').delete().eq('follower_id',userId).eq('following_id',targetId);if(result.error&&!(following&&result.error.code==='23505'))throw result.error;}
