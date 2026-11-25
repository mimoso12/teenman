import type {FeedPost} from './post-composer';
import {postPresentation} from './post-composer';
export type RankablePost=FeedPost & {likesCount:number;repostsCount:number;commentsCount:number};
export type UserInteractions={interactedPosts:FeedPost[];now:number};
export type RankedPost<T extends RankablePost=RankablePost>=T & {score:number;affinityLabel:string|null;trending:boolean};
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const categories=[{id:'cinema',label:'Cinema',words:/\b(cinema|filme|filmes|serie|series|trailer)\b/},{id:'music',label:'Música',words:/\b(musica|musicas|trilha|trilhas|cantor|cantora|banda|album|spotify)\b/},{id:'games',label:'Games',words:/\b(games?|jogos?|steam|playstation|xbox|nintendo)\b/},{id:'books',label:'Livros',words:/\b(livros?|leitura|escritor|escritora|manga)\b/},{id:'sports',label:'Esportes',words:/\b(esportes?|futebol|basquete|formula|corrida|brasileirao)\b/},{id:'civic',label:'Debate Cívico',words:/\b(politica|debate|deputado|senado|prefeito|vereador|congresso)\b/}];
const stop=new Set('para como isso essa esse este esta aqui voce voces muito mais menos pelo pela pelos pelas sobre agora ainda porque quando onde qual quais tudo todos todas entre mesmo mesma depois antes tambem pode podem quero acho vamos hoje ontem amanha estou estamos estao tinha tenho temos seria sendo fazer feito mundo gente algo cada apenas compartilhe compartilhado ouvir tocar produtora gravadora informado informada https http www com nao sim uma umas uns dos das que por nos nossa nosso suas seus seu sua meu minha meus minhas'.split(' '));
function features(post:FeedPost){const text=normalize(postPresentation(post).text.replace(/https?:\/\/\S+/g,' '));return {categories:categories.filter(c=>c.id===post.category||c.words.test(text)),hashtags:[...new Set(text.match(/#[\p{L}\p{N}_]+/gu)||[])],keywords:[...new Set((text.replace(/#[\p{L}\p{N}_]+/gu,' ').match(/\p{L}[\p{L}\p{N}]{3,}/gu)||[]).filter(word=>!stop.has(word)))]};}
const count=(value:number)=>Number.isFinite(value)?Math.max(0,value):0;
/** Pure and deterministic: the caller supplies the clock with interactions.now. */
export function rankPostsForUser<T extends RankablePost>(posts:readonly T[],interactions:UserInteractions):RankedPost<T>[] {
 const interests={categories:new Set<string>(),hashtags:new Set<string>(),keywords:new Set<string>()};
 for(const post of interactions.interactedPosts){const f=features(post);for(const c of f.categories)interests.categories.add(c.id);for(const tag of f.hashtags)interests.hashtags.add(tag);for(const word of f.keywords)interests.keywords.add(word);}
 const now=Number.isFinite(interactions.now)?interactions.now:0;
 const ranked=posts.map(post=>{const f=features(post),category=f.categories.find(c=>interests.categories.has(c.id)),tag=f.hashtags.find(t=>interests.hashtags.has(t)),word=f.keywords.find(w=>interests.keywords.has(w));
  const affinityLabel=category?.label||tag||word||null,engagement=count(post.likesCount)*3+count(post.repostsCount)*5+count(post.commentsCount)*4;
  const date=Date.parse(post.created_at),hours=Number.isFinite(date)?Math.max(0,(now-date)/3600000):Infinity;
  const score=(engagement+(affinityLabel?25:0)+(postPresentation(post).media?8:0))/Math.pow(hours+2,1.35);
  return {...post,score,affinityLabel,trending:engagement>=15};
 }).sort((a,b)=>b.score-a.score||((Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0))||a.id.localeCompare(b.id));
 // One priority-queue entry per author keeps diversification O(n log n),
 // including large inputs; no repeated scans or array shifts.
 type Bucket={posts:RankedPost<T>[];index:number};
 const buckets=new Map<string,Bucket>();for(const post of ranked){let bucket=buckets.get(post.author_id);if(!bucket){bucket={posts:[],index:0};buckets.set(post.author_id,bucket);}bucket.posts.push(post);}
 const heap:Bucket[]=[],head=(bucket:Bucket)=>bucket.posts[bucket.index];
 const before=(a:Bucket,b:Bucket)=>head(a).score>head(b).score||(head(a).score===head(b).score&&((Date.parse(head(a).created_at)||0)>(Date.parse(head(b).created_at)||0)||head(a).created_at===head(b).created_at&&head(a).id<head(b).id));
 function push(bucket:Bucket){heap.push(bucket);let i=heap.length-1;while(i){const p=(i-1)>>1;if(!before(heap[i],heap[p]))break;[heap[i],heap[p]]=[heap[p],heap[i]];i=p;}}
 function pop(){const root=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;for(;;){let next=i,l=i*2+1,r=l+1;if(l<heap.length&&before(heap[l],heap[next]))next=l;if(r<heap.length&&before(heap[r],heap[next]))next=r;if(next===i)break;[heap[i],heap[next]]=[heap[next],heap[i]];i=next;}}return root;}
 for(const bucket of buckets.values())push(bucket);
 const result:RankedPost<T>[]=[];
 while(heap.length){let bucket=pop();const last=result.at(-1),previous=result.at(-2);if(last&&previous&&last.author_id===previous.author_id&&head(bucket).author_id===last.author_id&&heap.length){head(bucket).score*=.9;const other=pop();push(bucket);bucket=other;}result.push(bucket.posts[bucket.index++]);if(bucket.index<bucket.posts.length)push(bucket);}
 return result;
}
export type FollowingRepost={post_id:string;user_id:string;created_at:string};
export function followingTimeline<T extends FeedPost>(posts:readonly T[],following:readonly string[],reposts:readonly FollowingRepost[]){
 const ids=new Set(following),latest=new Map<string,FollowingRepost>();for(const row of reposts)if(ids.has(row.user_id)&&(!latest.has(row.post_id)||row.created_at>latest.get(row.post_id)!.created_at))latest.set(row.post_id,row);
 return posts.filter(post=>ids.has(post.author_id)||latest.has(post.id)).map(post=>{const shared=latest.get(post.id),repost=shared&&(!ids.has(post.author_id)||shared.created_at>post.created_at)?shared:null;return {...post,timelineAt:repost?.created_at||post.created_at,repostedBy:repost?.user_id||null};}).sort((a,b)=>b.timelineAt.localeCompare(a.timelineAt)||a.id.localeCompare(b.id));
}
