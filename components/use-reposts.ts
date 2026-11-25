'use client';
import {useEffect,useRef,useState} from 'react';
import {supabase} from '../lib/supabase';
import {fetchReposts,optimisticRepost,setRepost,type Repost} from '../lib/reposts';
export function useReposts(postIds:string[],userId:string|null){
 const key=[...new Set(postIds)].sort().join(','),ids=key?key.split(','):[];
 const [rows,setRows]=useState<Repost[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const current=useRef(rows),locked=useRef(false),version=useRef(0),mutationError=useRef(''),refresh=useRef<()=>Promise<void>>(async()=>{});current.current=rows;
 useEffect(()=>{let active=true,timer:ReturnType<typeof setTimeout>;const client=supabase;setRows([]);setLoading(true);setError('');
  async function load(){if(!client||locked.current)return;const id=++version.current;try{const data=await fetchReposts(client,ids);if(active&&version.current===id){setRows(data);setError(mutationError.current);}}catch{if(active&&version.current===id)setError('Não foi possível carregar as republicações. Tente novamente.');}finally{if(active&&version.current===id)setLoading(false);}}
  refresh.current=load;void load();const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>void load(),200);};
  window.addEventListener('teenman-reposts-changed',changed);
  const channel=client?.channel('reposts-'+crypto.randomUUID()).on('postgres_changes',{event:'*',schema:'public',table:'reposts'},changed).subscribe();
  return()=>{active=false;version.current++;clearTimeout(timer);window.removeEventListener('teenman-reposts-changed',changed);if(channel)void client!.removeChannel(channel);};
 },[key,userId]);
 async function toggle(postId:string){if(!supabase||!userId||locked.current||loading)return;locked.current=true;version.current++;mutationError.current='';setBusy(postId);setError('');const before=current.current,enabled=!before.some(row=>row.post_id===postId&&row.user_id===userId);setRows(optimisticRepost(before,postId,userId,enabled));try{await setRepost(supabase,postId,userId,enabled);window.dispatchEvent(new CustomEvent('teenman-reposts-changed',{detail:{postId,userId,enabled}}));}catch(err){mutationError.current=err instanceof Error?err.message:'Não foi possível republicar.';setRows(before);setError(mutationError.current);}finally{locked.current=false;setBusy(null);void refresh.current();}}
 return {rows,loading,busy,error,toggle,retry:()=>{mutationError.current='';void refresh.current();}};
}
