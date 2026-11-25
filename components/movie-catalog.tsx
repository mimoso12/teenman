'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {Search,Star,X} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import type {MovieItem,PersonItem,SearchFilter} from '../lib/tmdb';
import {useTmdb} from './use-tmdb';
import MoviePoster from './movie-poster';
import MovieDetails from './movie-details';
import PersonDetails from './person-details';
import PersonPhoto from './person-photo';
import OriginalsShowcase from './originals-showcase';
export default function MovieCatalog({user}:{user:User|null}){
  const router=useRouter(),params=useSearchParams();
  const [input,setInput]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(1),[selected,setSelected]=useState<MovieItem|null>(null);
  const [filter,setFilter]=useState<SearchFilter>('all'),[person,setPerson]=useState<PersonItem|null>(null);
  const {data,loading,error,retry}=useTmdb(query,page,filter),trending=useTmdb();
  useEffect(()=>{const timer=setTimeout(()=>{setQuery(input.trim());setPage(1);},500);return()=>clearTimeout(timer);},[input]);
  const focus=params.get('tmdb');
  useEffect(()=>{
    if(!focus)return;
    const candidate=[...(data?.items||[]),...(trending.data?.items||[])].find(item=>`${item.mediaType}:${item.id}`===focus);
    if(candidate)setSelected(current=>current?.id===candidate.id&&current.mediaType===candidate.mediaType?current:candidate);
  },[focus,data,trending.data]);
  function close(){setSelected(null);if(focus)router.replace('/feed?view=catalog',{scroll:false});}
  function search(event:FormEvent){event.preventDefault();setQuery(input.trim());setPage(1);}
  return <section className="movie-catalog" aria-label="Filmes e Livros">
    <OriginalsShowcase viewerId={user?.id||null}/>
    <section className="tmdb-catalog" aria-labelledby="tmdb-catalog-title"><header><span className="catalog-eyebrow">PARA A SUA PRÓXIMA SESSÃO</span><h2 id="tmdb-catalog-title">{query?'Encontre sua próxima história.':'Em alta nesta semana.'}</h2><p className="catalog-description">Filmes e séries para assistir, descobrir e conversar.</p></header><form className="catalog-search" role="search" onSubmit={search}><Search size={18}/><label className="sr-only" htmlFor="tmdb-search">Buscar filmes, séries e atores</label><input id="tmdb-search" placeholder="Buscar filmes, séries e atores" value={input} maxLength={120} onChange={event=>setInput(event.target.value)}/>{input&&<button type="button" aria-label="Limpar busca de filmes" onClick={()=>{setInput('');setQuery('');setPage(1);}}><X size={17}/></button>}<button type="submit" className="catalog-search-submit">Buscar</button></form>
      <div className="catalog-filters" role="group" aria-label="Filtrar catálogo">{([{id:'all',label:'Todos'},{id:'movie',label:'Filmes'},{id:'person',label:'Atores'}] as const).map(item=><button key={item.id} aria-pressed={filter===item.id} onClick={()=>{setFilter(item.id);setPage(1);}}>{item.label}</button>)}</div>
      {loading?<div className="poster-grid catalog-skeleton" role="status" aria-label="Carregando filmes">{Array.from({length:6},(_,i)=><div key={i}/>)}</div>:error?<div className="catalog-empty"><h3>O catálogo faz uma breve pausa.</h3><p>{error}</p><button className="pill outline" onClick={retry}>Tentar novamente</button></div>:data?.items.length===0&&!data?.people?.length?<div className="catalog-empty"><h3>Nenhuma história encontrada.</h3><p>Tente outro título de filme ou série.</p></div>:<><div className="poster-grid">{data?.people?.map(person=><button className="movie-tile person-tile" key={`person-${person.id}`} onClick={()=>setPerson(person)} aria-label={`Ver biografia de ${person.name}`}><PersonPhoto person={person}/><strong>{person.name}</strong><span className="movie-tile-meta">Pessoa do cinema</span></button>)}{data?.items.map(item=><button className="movie-tile" key={`${item.mediaType}-${item.id}`} onClick={()=>setSelected(item)} aria-label={`Ver detalhes de ${item.title}`}><MoviePoster url={item.posterUrl} title={item.title}/><span className="movie-tile-rating"><Star size={11} fill="currentColor"/>{item.rating}</span><strong>{item.title}</strong><span className="movie-tile-meta">{item.year}<span>·</span>{item.mediaType==='tv'?'Série':'Filme'}</span></button>)}</div>{data&&data.totalPages>1&&<nav className="catalog-pagination" aria-label="Páginas do catálogo"><button className="pill outline" disabled={page===1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="pill outline" disabled={page>=data.totalPages} onClick={()=>setPage(value=>value+1)}>Próxima</button></nav>}</>}
      <footer className="tmdb-credits" aria-label="Créditos do catálogo"><a href="https://www.themoviedb.org" target="_blank" rel="noopener noreferrer" className="tmdb-mark">TMDB</a><p>Dados e imagens: The Movie Database.<br/>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></footer>
    </section>
    <MovieDetails movie={selected} onClose={close} user={user} onPerson={setPerson}/>
    <PersonDetails person={person} onClose={()=>setPerson(null)} user={user} onMovie={movie=>{setPerson(null);setSelected(movie);}}/>
  </section>;
}
