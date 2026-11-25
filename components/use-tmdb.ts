'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {TmdbPage,SearchFilter} from '../lib/tmdb';
const cached=new Map<string,{data:TmdbPage;expires:number}>(),pending=new Map<string,Promise<TmdbPage>>();
async function request(query:string,page:number,force:boolean,filter:SearchFilter){
  const key=JSON.stringify([query.trim().toLocaleLowerCase('pt-BR'),page,filter]);
  const hit=cached.get(key);if(!force&&hit&&hit.expires>Date.now())return hit.data;
  if(pending.has(key))return pending.get(key)!;
  const task=(async()=>{
    const response=await fetch(`/api/tmdb?${new URLSearchParams({query:query.trim(),page:String(page),filter})}`,{signal:AbortSignal.timeout(11000)});
    const data=await response.json();if(!response.ok||data.unavailable)throw new Error(data.error||'Não foi possível carregar o catálogo.');
    if(!Array.isArray(data.items))throw new Error('O catálogo não está disponível agora.');
    if(cached.size>=60)cached.delete(cached.keys().next().value!);
    cached.set(key,{data,expires:Date.now()+3600000});return data as TmdbPage;
  })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
export function useTmdb(query='',page=1,filter:SearchFilter='all'){
  const normalized=query.trim();
  const [data,setData]=useState<TmdbPage|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const current=useRef({query:normalized,page,filter}),last=useRef({query:normalized,page,filter}),mounted=useRef(false),sequence=useRef(0);
  current.current={query:normalized,page,filter};
  const load=useCallback((value:{query:string;page:number;filter:SearchFilter},force=false)=>{
    const id=++sequence.current;
    setLoading(true);setError('');
    void request(value.query,value.page,force,value.filter).then(result=>{if(mounted.current&&sequence.current===id)setData(result);})
      .catch(err=>{if(mounted.current&&sequence.current===id)setError(err instanceof Error?err.message:'Não foi possível carregar o catálogo.');})
      .finally(()=>{if(mounted.current&&sequence.current===id)setLoading(false);});
  },[]);
  // A montagem e a busca por mudanças são independentes dos estados da resposta.
  useEffect(()=>{mounted.current=true;load(current.current);return()=>{mounted.current=false;sequence.current++;};},[]);
  useEffect(()=>{
    if(last.current.query===normalized&&last.current.page===page&&last.current.filter===filter)return;
    last.current={query:normalized,page,filter};
    load(last.current);
  },[normalized,page,filter,load]);
  const retry=useCallback(()=>load(current.current,true),[load]);
  return {data,loading,error,retry};
}
