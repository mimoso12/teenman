'use client';
import {useEffect,useState} from 'react';
const cache=new Map<string, {data:unknown;expires:number}>(),pending=new Map<string,Promise<unknown>>();
async function request(url:string,timeout:number){
  const hit=cache.get(url);if(hit&&hit.expires>Date.now())return hit.data;
  if(pending.has(url))return pending.get(url);
  const task=(async()=>{const response=await fetch(url,{signal:AbortSignal.timeout(timeout)});const json=await response.json();if(!response.ok||!json.details)throw new Error('unavailable');if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(url,{data:json.details,expires:Date.now()+3600000});return json.details;})();
  pending.set(url,task);try{return await task;}finally{pending.delete(url);}
}
export function useTmdbDetails<T>(url:string|null,timeout=11000){
  const [state,setState]=useState<{url:string|null;data:T|null;loading:boolean;error:boolean}>({url:null,data:null,loading:false,error:false});
  useEffect(()=>{if(!url)return;let active=true;setState({url,data:null,loading:true,error:false});void request(url,timeout).then(data=>{if(active)setState({url,data:data as T,loading:false,error:false});}).catch(()=>{if(active)setState({url,data:null,loading:false,error:true});});return()=>{active=false;};},[url,timeout]);
  return state.url===url?state:{url,data:null,loading:Boolean(url),error:false};
}
