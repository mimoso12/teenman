'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import {Check,MessageCircle,Star,X} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';
import {moviePostContent,type MovieItem,type PersonItem,type MovieDetailsData} from '../lib/tmdb';
import MoviePoster from './movie-poster';
import PersonPhoto from './person-photo';
import {useTmdbDetails} from './use-tmdb-details';
export default function MovieDetails({movie,onClose,user,onPerson}:{onPerson:(person:PersonItem)=>void;movie:MovieItem|null;onClose:()=>void;user:User|null}){
  const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false),postId=useRef<string|null>(null);
  const [opinion,setOpinion]=useState(''),[busy,setBusy]=useState(false),[posted,setPosted]=useState(false),[error,setError]=useState(''),[backdropFailed,setBackdropFailed]=useState(false);
  useEffect(()=>{if(movie){setOpinion('');setPosted(false);setError('');setBackdropFailed(false);postId.current=null;dialog.current?.showModal();}else dialog.current?.close();},[movie?.id,movie?.mediaType]);
  const details=useTmdbDetails<MovieDetailsData>(movie?`/api/tmdb/movie/${movie.id}?type=${movie.mediaType}`:null);
  async function publish(){
    if(!movie||!supabase||locked.current||posted)return;locked.current=true;setBusy(true);setError('');
    try{
      const auth=await supabase.auth.getUser();if(!auth.data.user)throw new Error('session');
      postId.current??=crypto.randomUUID();
      const payload={id:postId.current,author_id:auth.data.user.id,author_name:String(auth.data.user.user_metadata?.display_name||'Membro Teenman'),content:moviePostContent(movie,opinion)};
      const result=await supabase.from('posts').insert(payload);
      if(result.error){
        if(result.error.code!=='23505')throw result.error;
        const existing=await supabase.from('posts').select('id').eq('id',postId.current).eq('author_id',auth.data.user.id).maybeSingle();
        if(existing.error||!existing.data)throw result.error;
      }
      setPosted(true);window.dispatchEvent(new Event('teenman-post-created'));
    }catch{setError('Não foi possível publicar. Seu comentário foi mantido para tentar novamente.');}
    finally{locked.current=false;setBusy(false);}
  }
  return <dialog ref={dialog} className="catalog-dialog movie-dialog" aria-labelledby="movie-details-title" onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClick={event=>{if(event.target===dialog.current&&!busy)onClose();}}>
    <button className="catalog-dialog-close" aria-label="Fechar detalhes" onClick={onClose} disabled={busy}><X size={20}/></button>
    {movie&&<><div className="movie-backdrop">{movie.backdropUrl&&!backdropFailed&&<img loading="lazy" decoding="async" src={movie.backdropUrl} alt="" onError={()=>setBackdropFailed(true)}/>}<div className="movie-backdrop-shade"/></div><div className="movie-details-body"><div className="movie-details-heading"><MoviePoster key={`${movie.mediaType}-${movie.id}`} url={movie.posterUrl} title={movie.title}/><div><span className="catalog-eyebrow">{movie.mediaType==='tv'?'SÉRIE':'FILME'} · TMDB</span><h2 id="movie-details-title">{movie.title}</h2><p className="movie-meta"><span><Star size={15}/>{movie.rating}</span><span>{movie.year}</span></p><a className="movie-source" href={`https://www.themoviedb.org/${movie.mediaType}/${movie.id}`} target="_blank" rel="noopener noreferrer">Ver no TMDB</a></div></div><h3>Sinopse</h3><p className="movie-overview">{movie.overview}</p><section className="movie-credits" aria-label="Elenco e direção"><h3>Elenco & direção</h3>{details.loading?<p role="status" className="catalog-description">Carregando elenco…</p>:details.error?<p className="catalog-description">Elenco indisponível no momento.</p>:<><div className="cast-row">{details.data?.cast.map(person=><button key={person.id} onClick={()=>onPerson(person)}><PersonPhoto person={person}/><strong>{person.name}</strong><small>{person.character||'Elenco'}</small></button>)}</div><div className="director-row">{details.data?.directors.map(person=><button key={person.id} onClick={()=>onPerson(person)}><PersonPhoto person={person}/><span><small>Direção</small><strong>{person.name}</strong></span></button>)}</div>{!details.data?.cast.length&&!details.data?.directors.length&&<p className="catalog-description">Créditos ainda não disponíveis.</p>}</>}</section><div className="movie-comment-area">{posted?<div className="movie-posted" role="status"><Check size={18}/><span>Publicação criada com o pôster.</span><Link className="pill solid" href="/feed" onClick={onClose}>Ver no feed</Link></div>:user?<><label htmlFor="movie-opinion">Sua opinião <span>(opcional)</span></label><textarea id="movie-opinion" placeholder="O que essa história fez você sentir?" value={opinion} onChange={event=>setOpinion(event.target.value)} maxLength={600} rows={3} disabled={busy}/><button className="pill solid" onClick={publish} disabled={busy}><MessageCircle size={16}/>{busy?'Publicando…':'Comentar no Feed'}</button><small>O título e o pôster serão incluídos na publicação.</small></>:<Link className="pill outline" href="/">Entre para comentar no feed</Link>}{error&&<p className="vibe-message" role="status">{error}</p>}</div></div></>}
  </dialog>;
}
