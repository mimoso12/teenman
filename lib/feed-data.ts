import type {SupabaseClient} from '@supabase/supabase-js';
import type {FeedPost} from './post-composer';
import type {FollowingRepost} from './feedAlgorithm';
export type FeedLike={post_id:string;user_id:string;author_name:string;created_at:string};
export type FeedComment={id:string;post_id:string;author_id:string;author_name:string;content:string;created_at:string};
async function followingIds(client:SupabaseClient,userId:string){const rows:string[]=[];for(let offset=0;;offset+=500){const result=await client.from('follows').select('following_id').eq('follower_id',userId).order('following_id').range(offset,offset+499);if(result.error)throw result.error;rows.push(...(result.data||[]).map(r=>r.following_id));if((result.data||[]).length<500)break;}return rows;}
async function recentHistory(client:SupabaseClient,userId:string){const results=await Promise.allSettled([client.from('post_likes').select('post_id').eq('user_id',userId).order('created_at',{ascending:false}).limit(200),client.from('reposts').select('post_id').eq('user_id',userId).order('created_at',{ascending:false}).limit(200),client.from('post_comments').select('post_id').eq('author_id',userId).order('created_at',{ascending:false}).limit(200)]);const ids=new Set<string>();let partial=false;for(const result of results){if(result.status==='fulfilled'&&!result.value.error)for(const row of result.value.data||[])ids.add(row.post_id);else partial=true;}return {ids:[...ids],partial};}
async function postsByIds(client:SupabaseClient,ids:string[]){const posts:FeedPost[]=[];for(let start=0;start<ids.length;start+=100){const result=await client.from('posts').select('*').in('id',ids.slice(start,start+100));if(result.error)throw result.error;posts.push(...(result.data||[]));}return posts;}
export async function fetchFeedInteractions<T>(client:SupabaseClient,table:'post_likes'|'post_comments',ids:string[]):Promise<T[]>{const rows:T[]=[];for(let start=0;start<ids.length;start+=100){for(let offset=0;;offset+=500){let query=client.from(table).select('*').in('post_id',ids.slice(start,start+100));query=table==='post_likes'?query.order('post_id').order('user_id'):query.order('id');const result=await query.range(offset,offset+499);if(result.error)throw result.error;const page=result.data||[];rows.push(...page as T[]);if(page.length<500)break;}}return rows;}
export async function loadPersonalizedFeed(client:SupabaseClient,userId:string,focusedId=''){
 const [recent,followResult,historyResult]=await Promise.all([client.from('posts').select('*').order('created_at',{ascending:false}).limit(150),followingIds(client,userId).then(ids=>({ids,error:false})).catch(()=>({ids:[] as string[],error:true})),recentHistory(client,userId)]);
 if(recent.error)throw recent.error;const unavailable:string[]=[];if(followResult.error)unavailable.push('Pessoas seguidas');if(historyResult.partial)unavailable.push('Parte do histórico de interesses');
 const following=followResult.ids,additional:FeedPost[]=[],followingReposts:FollowingRepost[]=[];
 for(let start=0;start<following.length;start+=100){const ids=following.slice(start,start+100),[direct,shared]=await Promise.allSettled([client.from('posts').select('*').in('author_id',ids).order('created_at',{ascending:false}).limit(100),client.from('reposts').select('post_id,user_id,created_at').in('user_id',ids).order('created_at',{ascending:false}).limit(100)]);
  if(direct.status==='fulfilled'&&!direct.value.error)additional.push(...(direct.value.data||[]));else unavailable.push('Posts das pessoas seguidas');
  if(shared.status==='fulfilled'&&!shared.value.error)followingReposts.push(...(shared.value.data||[]));else unavailable.push('Republicações das pessoas seguidas');
 }
 additional.sort((a,b)=>b.created_at.localeCompare(a.created_at));additional.splice(100);
 followingReposts.sort((a,b)=>b.created_at.localeCompare(a.created_at));followingReposts.splice(100);
 try{additional.push(...await postsByIds(client,[...new Set(followingReposts.map(row=>row.post_id))]));}catch{unavailable.push('Posts republicados');}
 if(focusedId&&/^[a-f0-9-]{36}$/i.test(focusedId)){try{additional.push(...await postsByIds(client,[focusedId]));}catch{unavailable.push('Publicação da notificação');}}
 const posts=[...new Map([...(recent.data||[]),...additional].map(post=>[post.id,post as FeedPost])).values()];
 let interactedPosts:FeedPost[]=[];try{interactedPosts=await postsByIds(client,historyResult.ids);}catch{unavailable.push('Posts do histórico');}
 const ids=posts.map(post=>post.id),[likesResult,commentsResult]=await Promise.allSettled([fetchFeedInteractions<FeedLike>(client,'post_likes',ids),fetchFeedInteractions<FeedComment>(client,'post_comments',ids)]);
 if(likesResult.status==='rejected')unavailable.push('Curtidas');if(commentsResult.status==='rejected')unavailable.push('Comentários');
 return {posts,following,followingReposts,interactedPosts,likes:likesResult.status==='fulfilled'?likesResult.value:[],comments:commentsResult.status==='fulfilled'?commentsResult.value.sort((a,b)=>a.created_at.localeCompare(b.created_at)):[],socialReady:likesResult.status==='fulfilled'&&commentsResult.status==='fulfilled'&&!followResult.error,unavailable:[...new Set(unavailable)]};
}
