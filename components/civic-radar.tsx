'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import type {User} from '@supabase/supabase-js';
import {Landmark,Search,X} from 'lucide-react';
import {states,type CivicPerson,type House} from '../lib/civic';
import CivicParties from './civic-parties';
import {CivicModal,Portrait} from './civic-person-modal';
type Filter=House|'todos'|'partidos'|'prefeitos'|'vereadores';
type CivicList={results:CivicPerson[];unavailable:string[];total?:number;hasMore?:boolean;sourceNote?:string};
const cache=new Map<string,{data:CivicList;expires:number}>(),pending=new Map<string,Promise<CivicList>>();
async function load(url:string){
 const hit=cache.get(url);if(hit&&hit.expires>Date.now())return hit.data;if(pending.has(url))return pending.get(url)!;
 const task=(async()=>{const response=await fetch(url,{signal:AbortSignal.timeout(30000)}),data=await response.json();if(!response.ok||!Array.isArray(data.results))throw new Error('Não foi possível consultar os representantes.');if(cache.size>=50)cache.delete(cache.keys().next().value!);cache.set(url,{data,expires:Date.now()+(data.unavailable?.length?15000:3600000)});return data as CivicList;})();pending.set(url,task);try{return await task;}finally{pending.delete(url);}
}
export default function CivicRadar({user}:{user:User|null}){
 const [input,setInput]=useState(''),[nome,setNome]=useState(''),[cityInput,setCityInput]=useState(''),[municipio,setMunicipio]=useState('');
 const [casa,setCasa]=useState<Filter>('todos'),[uf,setUf]=useState(''),[selected,setSelected]=useState<CivicPerson|null>(null);
 const [data,setData]=useState<CivicList|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[limit,setLimit]=useState(60),[pagina,setPagina]=useState(1);
 const activeBase=useRef('');const municipal=casa==='prefeitos'||casa==='vereadores';
 useEffect(()=>{const timer=setTimeout(()=>{setNome(input.trim());setMunicipio(cityInput.trim());setPagina(1);},500);return()=>clearTimeout(timer);},[input,cityInput]);
 const baseKey=JSON.stringify([casa,nome,uf,municipio]);
 const url=`/api/civic?${new URLSearchParams({casa,nome,uf,municipio,pagina:String(pagina)})}`;
 useEffect(()=>{
  if(casa==='partidos')return;let active=true;setLoading(true);setError('');if(pagina===1)setLimit(60);
  void load(url).then(result=>{if(!active)return;
   const append=pagina>1&&activeBase.current===baseKey;
   setData(previous=>append&&previous?{...result,results:[...new Map([...previous.results,...result.results].map(person=>[person.casa+person.id,person])).values()]}:result);
   activeBase.current=baseKey;if(pagina>1)setLimit(value=>value+120);
  }).catch(err=>{if(active){if(pagina===1)setData(null);setError(err instanceof Error?err.message:'Fontes indisponíveis.');}}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[url,retry,casa,pagina,baseKey]);
 function search(event:FormEvent){event.preventDefault();setNome(input.trim());setMunicipio(cityInput.trim());setPagina(1);}
 function more(){if(data&&limit<data.results.length)setLimit(value=>value+60);else if(data?.hasMore)setPagina(value=>value+1);}
 function sourceName(value:string){return ({camara:'Câmara Federal',senado:'Senado',prefeitos:'Prefeitos • Políticos BR',vereadores:'Vereadores • Políticos BR'} as Record<string,string>)[value]||value;}
 return <main className="social-main civic-page"><header className="music-page-header civic-header"><div><Landmark size={22}/><h1>Radar Cívico <span>• Brasil, estados e municípios</span></h1></div>
 <form className="catalog-search" role="search" onSubmit={search}><Search size={18}/><label className="sr-only" htmlFor="civic-search">{casa==='partidos'?'Buscar partido por sigla ou nome':'Buscar representante por nome'}</label><input id="civic-search" value={input} onChange={event=>setInput(event.target.value)} maxLength={120} placeholder={casa==='partidos'?'Sigla ou nome oficial do partido':'Nome do deputado, senador, prefeito ou vereador'}/>{input&&<button type="button" aria-label="Limpar busca cívica" onClick={()=>{setInput('');setNome('');setPagina(1);}}><X size={16}/></button>}<button className="catalog-search-submit">Buscar</button></form>
 <div className="catalog-filters civic-filters" role="group" aria-label="Cargo ou Casa legislativa">{([{id:'todos',nome:'Todos'},{id:'camara',nome:'Câmara Federal'},{id:'senado',nome:'Senado'},{id:'prefeitos',nome:'Prefeitos'},{id:'vereadores',nome:'Vereadores'},{id:'partidos',nome:'Partidos'}] as const).map(item=><button key={item.id} aria-pressed={casa===item.id} onClick={()=>{setCasa(item.id);setPagina(1);if(!['prefeitos','vereadores'].includes(item.id)){setCityInput('');setMunicipio('');}}}>{item.nome}</button>)}</div>
 {casa!=='partidos'&&<div className="civic-location-filters"><label className="civic-state">Estado<select value={uf} onChange={event=>{setUf(event.target.value);setPagina(1);}}><option value="">Todos os estados</option>{states.map(item=><option key={item}>{item}</option>)}</select></label>{municipal&&<label className="civic-city">Cidade / Município<input value={cityInput} onChange={event=>setCityInput(event.target.value)} maxLength={120} placeholder="Ex.: Cruz das Almas"/></label>}</div>}</header>
 {casa==='partidos'?<CivicParties query={nome} user={user} onMember={setSelected}/>:<section className="civic-content"><span className="catalog-eyebrow">INFORMAÇÃO PÚBLICA, CONVERSA ABERTA</span><p className="catalog-description">Representantes do Congresso e dos municípios, com fonte e contexto dos dados.</p>{(municipal||casa==='todos')&&<p className="civic-source-note">Políticos BR: base eleitoral do TSE de 2024. Mudanças posteriores de partido ou mandato podem não estar refletidas.</p>}
 {loading?<div className="civic-grid civic-skeleton" role="status" aria-label="Carregando representantes">{Array.from({length:6},(_,i)=><div key={i}/>)}</div>:error?<div className="catalog-empty"><h2>Não foi possível consultar os representantes.</h2><p>{error}</p><button className="pill outline" onClick={()=>{cache.delete(url);setRetry(value=>value+1);}}>Tentar novamente</button></div>:<>{!!data?.unavailable.length&&<div className="civic-warning" role="status"><p>{data.unavailable.map(sourceName).join(' e ')}: fonte temporariamente indisponível. Os resultados disponíveis continuam abaixo.</p><button onClick={()=>{cache.delete(url);setRetry(value=>value+1);}}>Tentar novamente</button></div>}
 <p className="civic-count">{data?.results.length||0} registros carregados{data?.total!==undefined?' • '+data.total+' encontrados nas fontes disponíveis':''}</p>
 {!data?.results.length?<div className="catalog-empty"><h2>{data?.unavailable.length?'Consulta temporariamente indisponível.':'Nenhum representante encontrado.'}</h2><p>Tente outro nome, estado, município ou cargo.</p></div>:<><div className="civic-grid">{data.results.slice(0,limit).map(person=><button key={person.casa+person.id} className="civic-card" aria-label={`Ver ${person.nome}, ${person.casa}`} onClick={()=>setSelected(person)}><Portrait person={person}/><strong>{person.nome}</strong><span className="civic-party">{person.partido} - {person.uf}</span>{person.municipio&&<span className="municipal-card-city">{person.municipio} / {person.uf}</span>}<span className="civic-house">{person.cargo||person.casa}</span></button>)}</div>{(limit<data.results.length||data.hasMore)&&<button className="pill outline civic-load-more" onClick={more}>Mostrar mais representantes</button>}</>}</>}
 <footer className="civic-footer"><p>Fontes: <a href="https://dadosabertos.camara.leg.br/" target="_blank" rel="noopener noreferrer">Câmara dos Deputados</a>, <a href="https://www12.senado.leg.br/dados-abertos" target="_blank" rel="noopener noreferrer">Senado Federal</a> e <a href="https://maquinapublica.com.br/docs" target="_blank" rel="noopener noreferrer">Políticos BR</a> (dados eleitorais do TSE). Consultas em cache por até uma hora. O Teenman não é um serviço oficial dessas instituições.</p></footer></section>}
 <CivicModal person={selected} user={user} onClose={()=>setSelected(null)}/></main>;
}
