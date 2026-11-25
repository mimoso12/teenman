'use client';
import Link from 'next/link';
import {Star} from 'lucide-react';
import {useTmdb} from './use-tmdb';
import MoviePoster from './movie-poster';
export default function TrendingCinema(){
  const {data,loading,error,retry}=useTmdb();
  return <section className="discovery-card trending-cinema" aria-labelledby="trending-cinema-title"><h2 id="trending-cinema-title">Em Alta no Cinema</h2><p className="trending-subtitle">Os destaques da semana no TMDB</p>{loading?<p className="trending-status" role="status">Carregando filmes…</p>:error?<div className="trending-error"><p>Não foi possível carregar os destaques.</p><button onClick={retry}>Tentar novamente</button></div>:data?.items.slice(0,3).map((item,index)=><Link key={`${item.mediaType}-${item.id}`} className="trending-movie" href={`/feed?view=catalog&tmdb=${item.mediaType}:${item.id}`}><span className="trending-rank">{index+1}</span><MoviePoster small url={item.posterUrl} title={item.title}/><span><strong>{item.title}</strong><small><Star size={11} fill="currentColor"/>{item.rating}<span>·</span>{item.year}</small></span></Link>)}<Link className="show-more" href="/feed?view=catalog">Explorar filmes e livros</Link></section>;
}
