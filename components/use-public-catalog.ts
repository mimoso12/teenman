'use client';
import {useEffect,useState} from 'react';
const cache=new Map<string,{data:any;expires:number}>(),pending=new Map<string,Promise<any>>();
async function request(url:string,ttl:number){const hit=cache.get(url);if(hit&&hit.expires>Date.now())return hit.data;if(pending.has(url))return pending.get(url);const task=(async()=>{const response=await fetch(url,{signal:AbortSignal.timeout(30000)}),data=await response.json();if(!response.ok||data.error)throw new Error(data.error||'Não foi possível carregar os dados.');if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(url,{data,expires:Date.now()+(data.unavailable?.length?15000:ttl*1000)});return data;})();pending.set(url,task);try{return await task;}finally{pending.delete(url);}}
export function usePublicCatalog<T>(url:string,ttl:number){const [state,setState]=useState<{url:string;data:T|null;loading:boolean;error:string}>({url:'',data:null,loading:true,error:''}),[version,setVersion]=useState(0);
 useEffect(()=>{let active=true;setState({url,data:null,loading:true,error:''});void request(url,ttl).then(data=>{if(active)setState({url,data:data as T,loading:false,error:''});}).catch(error=>{if(active)setState({url,data:null,loading:false,error:error instanceof Error?error.message:'Fonte indisponível.'});});return()=>{active=false;};},[url,ttl,version]);
 const current=state.url===url?state:{url,data:null,loading:true,error:''};return {...current,retry:()=>{cache.delete(url);setVersion(value=>value+1);}};
}
export function useDebouncedQuery(input:string){const [query,setQuery]=useState(input.trim());useEffect(()=>{const timer=setTimeout(()=>setQuery(input.trim()),500);return()=>clearTimeout(timer);},[input]);return query;}
