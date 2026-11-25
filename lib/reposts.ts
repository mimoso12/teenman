import type {SupabaseClient} from '@supabase/supabase-js';
import type {FeedPost} from './post-composer';
export type Repost={post_id:string;user_id:string;created_at:string};
export type TimelinePost=FeedPost & {repostedAt?:string;timelineAt:string};
export function mergeProfileTimeline(own:FeedPost[],shared:FeedPost[],reposts:Repost[]):TimelinePost[]{
 const times=new Map<string,string>();for(const row of reposts){if(!times.has(row.post_id)||row.created_at>times.get(row.post_id)!)times.set(row.post_id,row.created_at);}
 const unique=new Map<string,TimelinePost>();for(const post of [...own,...shared]){const repostedAt=times.get(post.id);unique.set(post.id,{...post,...(repostedAt?{repostedAt}:{}),timelineAt:repostedAt&&repostedAt>post.created_at?repostedAt:post.created_at});}
 return [...unique.values()].sort((a,b)=>b.timelineAt.localeCompare(a.timelineAt)||a.id.localeCompare(b.id));
}
export function optimisticRepost(rows:Repost[],postId:string,userId:string,enabled:boolean){const next=rows.filter(row=>row.post_id!==postId||row.user_id!==userId);if(enabled)next.push({post_id:postId,user_id:userId,created_at:new Date().toISOString()});return next;}
export async function fetchReposts(client:SupabaseClient,ids:string[]):Promise<Repost[]>{
 const unique=[...new Set(ids)].sort(),rows:Repost[]=[];
 for(let batch=0;batch<unique.length;batch+=100){for(let offset=0;;offset+=500){const result=await client.from('reposts').select('post_id,user_id,created_at').in('post_id',unique.slice(batch,batch+100)).order('post_id').order('user_id').range(offset,offset+499);if(result.error)throw result.error;const page=result.data||[];rows.push(...page);if(page.length<500)break;}}
 return [...new Map(rows.map(row=>[row.post_id+':'+row.user_id,row])).values()];
}
export async function setRepost(client:SupabaseClient,postId:string,userId:string,enabled:boolean){
 const auth=await client.auth.getUser();if(auth.data.user?.id!==userId)throw new Error('Entre novamente para republicar.');
 const result=enabled?await client.from('reposts').insert({post_id:postId,user_id:userId}):await client.from('reposts').delete().eq('post_id',postId).eq('user_id',userId);
 if(result.error&&!(enabled&&result.error.code==='23505'))throw new Error('Não foi possível atualizar a republicação. Tente novamente.');
}
export async function loadProfileTimeline(client:SupabaseClient,profileId:string,onlyReposts=false):Promise<TimelinePost[]>{
 const [own,result]=await Promise.all([onlyReposts?Promise.resolve({data:[],error:null}):client.from('posts').select('*').eq('author_id',profileId).order('created_at',{ascending:false}).limit(100),client.from('reposts').select('post_id,user_id,created_at').eq('user_id',profileId).order('created_at',{ascending:false}).limit(100)]);
 if(own.error)throw own.error;if(result.error)throw result.error;
 const rows=result.data||[],ids=[...new Set(rows.map(row=>row.post_id))];let shared:FeedPost[]=[];
 if(ids.length){const posts=await client.from('posts').select('*').in('id',ids);if(posts.error)throw posts.error;shared=posts.data||[];}
 return mergeProfileTimeline(own.data||[],shared,rows).slice(0,100);
}
