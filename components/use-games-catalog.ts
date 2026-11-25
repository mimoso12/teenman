'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {mergeGameItems,type GameItem} from '../lib/games';
type Page={results:GameItem[];unavailable:string[];hasMore:boolean;page:number};
type State={key:string;results:GameItem[];unavailable:string[];hasMore:boolean;page:number;loading:boolean;loadingMore:boolean;error:string;moreError:string};
const cache=new Map<string,{data:Page;expires:number}>(),pending=new Map<string,Promise<Page>>();
async function request(base:string,page:number){
 const url=`${base}&page=${page}`,hit=cache.get(url);if(hit&&hit.expires>Date.now())return hit.data;if(pending.has(url))return pending.get(url)!;
 const task=(async()=>{const response=await fetch(url,{signal:AbortSignal.timeout(25000)}),data=await response.json();if(!response.ok||data.error||!Array.isArray(data.results))throw new Error(data.error||'Não foi possível carregar os jogos.');const value:Page={results:data.results,unavailable:data.unavailable||[],hasMore:Boolean(data.hasMore),page};if(cache.size>=80)cache.delete(cache.keys().next().value!);cache.set(url,{data:value,expires:Date.now()+(value.unavailable.length?15000:3600000)});return value;})();pending.set(url,task);try{return await task;}finally{pending.delete(url);}
}
function initial(key:string):State{return {key,results:[],unavailable:[],hasMore:false,page:0,loading:true,loadingMore:false,error:'',moreError:''};}
export function useGamesCatalog(base:string){
 const [state,setState]=useState<State>(()=>initial(base)),[version,setVersion]=useState(0);
 const current=useRef(state),generation=useRef(0),moreLock=useRef(false);current.current=state;
 useEffect(()=>{
  const id=++generation.current;moreLock.current=false;setState(initial(base));
  void request(base,1).then(data=>{if(generation.current===id)setState({...initial(base),...data,loading:false});}).catch(error=>{if(generation.current===id)setState({...initial(base),loading:false,error:error instanceof Error?error.message:'Fonte indisponível.'});});
  return()=>{generation.current++;};
 },[base,version]);
 const loadMore=useCallback(()=>{
  const previous=current.current;if(previous.key!==base||previous.loading||!previous.hasMore||moreLock.current)return;
  moreLock.current=true;const id=generation.current,page=previous.page+1;
  setState(value=>({...value,loadingMore:true,moreError:''}));
  void request(base,page).then(data=>{if(generation.current===id)setState(value=>value.key===base?{...value,...data,results:mergeGameItems(value.results,data.results),loadingMore:false,moreError:''}:value);})
   .catch(error=>{if(generation.current===id)setState(value=>({...value,loadingMore:false,moreError:error instanceof Error?error.message:'Não foi possível carregar a próxima página.'}));})
   .finally(()=>{if(generation.current===id)moreLock.current=false;});
 },[base]);
 const retry=useCallback(()=>{cache.delete(`${base}&page=1`);setVersion(value=>value+1);},[base]);
 return {...(state.key===base?state:initial(base)),loadMore,retry};
}
