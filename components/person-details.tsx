'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {X} from 'lucide-react';
import type {User} from '@supabase/supabase-js';
import {personPostContent,type PersonItem,type PersonDetailsData,type MovieItem} from '../lib/tmdb';
import {supabase} from '../lib/supabase';
import {useTmdbDetails} from './use-tmdb-details';
import PersonPhoto from './person-photo';
import MoviePoster from './movie-poster';
export default function PersonDetails({person,onClose,onMovie,user}:{person:PersonItem|null;onClose:()=>void;onMovie:(movie:MovieItem)=>void;user:User|null}){
  const dialog=useRef<HTMLDialogElement>(null),lock=useRef(false),postId=useRef<string|null>(null);
  const [opinion,setOpinion]=useState(''),[busy,setBusy]=useState(false),[posted,setPosted]=useState(false),[error,setError]=useState('');
  const details=useTmdbDetails<PersonDetailsData>(person?`/api/tmdb/person/${person.id}`:null);
  useEffect(()=>{if(person){setOpinion('');setPosted(false);setError('');postId.current=null;dialog.current?.showModal();}else dialog.current?.close();},[person?.id]);
  async function publish(){
    if(!person||!supabase||lock.current||posted)return;lock.current=true;setBusy(true);setError('');
    try{
      const {data}=await supabase.auth.getUser();if(!data.user)throw new Error('session');
      postId.current??=crypto.randomUUID();
      const result=await supabase.from('posts').insert({id:postId.current,author_id:data.user.id,author_name:String(data.user.user_metadata?.display_name||'Membro Teenman'),content:personPostContent(person,opinion)});
      if(result.error){if(result.error.code!=='23505')throw result.error;const existing=await supabase.from('posts').select('id').eq('id',postId.current).eq('author_id',data.user.id).maybeSingle();if(existing.error||!existing.data)throw result.error;}
      setPosted(true);window.dispatchEvent(new Event('teenman-post-created'));
    }catch{setError('Não foi possível publicar. Sua opinião foi mantida.');}finally{lock.current=false;setBusy(false);}
  }
  return <dialog ref={dialog} className="catalog-dialog person-dialog" aria-labelledby="person-details-title" onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClick={event=>{if(event.target===dialog.current&&!busy)onClose();}}><button className="catalog-dialog-close" aria-label="Fechar biografia" onClick={onClose} disabled={busy}><X size={20}/></button>{person&&<div className="person-details-body"><header><PersonPhoto key={person.id} person={person}/><div><span className="catalog-eyebrow">PESSOAS DO CINEMA</span><h2 id="person-details-title">{person.name}</h2><a className="movie-source" href={`https://www.themoviedb.org/person/${person.id}`} target="_blank" rel="noopener noreferrer">Ver no TMDB</a></div></header>{details.loading?<p role="status" className="catalog-description">Carregando biografia…</p>:details.error?<p role="status" className="catalog-description">A biografia está indisponível no momento.</p>:<><h3>Biografia</h3><p className="person-biography">{details.data?.biography||'Biografia em português ainda não disponível.'}</p><h3>Principais filmes</h3>{details.data?.movies.length?<div className="person-filmography">{details.data.movies.map(movie=><button key={movie.id} onClick={()=>{onClose();onMovie(movie);}}><MoviePoster url={movie.posterUrl} title={movie.title}/><strong>{movie.title}</strong><small>{movie.year}</small></button>)}</div>:<p className="catalog-description">Nenhum filme disponível.</p>}</>}<div className="movie-comment-area">{posted?<div role="status"><p>Menção publicada com a foto.</p><Link href="/feed" className="pill solid" onClick={onClose}>Ver no feed</Link></div>:user?<><label htmlFor="person-opinion">Sua opinião <span>(opcional)</span></label><textarea id="person-opinion" value={opinion} onChange={e=>setOpinion(e.target.value)} maxLength={600} rows={2} disabled={busy} placeholder="Qual atuação marcou você?"/><button className="pill solid" disabled={busy} onClick={publish}>{busy?'Publicando…':'Mencionar no Feed'}</button></>:<Link href="/" className="pill outline">Entre para mencionar no feed</Link>}{error&&<p role="status">{error}</p>}</div></div>}</dialog>;
}
