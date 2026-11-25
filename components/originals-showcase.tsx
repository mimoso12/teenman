'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {BookOpen,Film,Plus,X} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {safeCatalogUrl} from '../lib/tmdb';
type Original={id:string;creator_id:string;title:string;kind:'book'|'movie'|'series';synopsis:string;cover_url:string;link_url:string};
const kinds={book:'Livro',movie:'Filme',series:'Série'};
export default function OriginalsShowcase({viewerId,onlyKind}:{viewerId:string|null;onlyKind?:'book'}){
  const [titles,setTitles]=useState<Original[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[canCreate,setCanCreate]=useState(false);
  const [title,setTitle]=useState(''),[kind,setKind]=useState<Original['kind']>('book'),[synopsis,setSynopsis]=useState(''),[cover,setCover]=useState(''),[link,setLink]=useState('');
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const dialog=useRef<HTMLDialogElement>(null),locked=useRef(false);
  const load=useCallback(async()=>{
    if(!supabase){setError('A vitrine autoral está indisponível no momento.');setLoading(false);return;}
    try{
      const baseQuery=supabase.from('original_titles').select('id,creator_id,title,kind,synopsis,cover_url,link_url');
      const result=await (onlyKind?baseQuery.eq('kind',onlyKind):baseQuery).order('created_at',{ascending:false}).limit(30);
      if(result.error)setError('A vitrine autoral ainda não está disponível.');else{setTitles(result.data||[]);setError('');}
      if(viewerId){const role=await supabase.from('catalog_editors').select('role').eq('user_id',viewerId).maybeSingle();setCanCreate(!role.error&&['admin','creator'].includes(role.data?.role));}else setCanCreate(false);
    }catch{setError('Não foi possível conectar à vitrine autoral.');}finally{setLoading(false);}
  },[viewerId,onlyKind]);
  useEffect(()=>{void load();},[load]);
  async function save(event:FormEvent){
    event.preventDefault();if(!supabase||locked.current)return;
    const coverUrl=safeCatalogUrl(cover),linkUrl=safeCatalogUrl(link);
    if(!title.trim()||!synopsis.trim()||!coverUrl||!linkUrl){setMessage('Preencha o título, a sinopse e links HTTPS válidos para a capa e a obra.');return;}
    locked.current=true;setBusy(true);setMessage('');
    try{
      const auth=await supabase.auth.getUser();if(!auth.data.user)throw new Error('session');
      const role=await supabase.from('catalog_editors').select('role').eq('user_id',auth.data.user.id).maybeSingle();
      if(role.error||!['admin','creator'].includes(role.data?.role))throw new Error('role');
      const result=await supabase.from('original_titles').insert({creator_id:auth.data.user.id,title:title.trim(),kind,synopsis:synopsis.trim(),cover_url:coverUrl,link_url:linkUrl});
      if(result.error)throw result.error;
      setTitle('');setSynopsis('');setCover('');setLink('');dialog.current?.close();await load();
    }catch{setMessage('Não foi possível cadastrar a obra. Confira sua conexão e a autorização de criador.');}finally{locked.current=false;setBusy(false);}
  }
  return <section className="originals-showcase" aria-labelledby="originals-title"><header><div><span className="catalog-eyebrow">DA NOSSA COMUNIDADE</span><h1 id="originals-title">Originais & Livros Teenman</h1></div>{canCreate&&<button className="pill outline add-original" onClick={()=>{setMessage('');dialog.current?.showModal();}}><Plus size={15}/>Adicionar título</button>}</header><p className="catalog-description">Histórias autorais, novas vozes e produções para descobrir.</p>
    {loading?<p className="catalog-status" role="status">Carregando obras…</p>:error?<div className="catalog-inline-error"><p>{error}</p><button onClick={()=>{setLoading(true);void load();}}>Tentar novamente</button></div>:titles.length===0?<div className="originals-empty"><BookOpen size={24}/><p>As próximas histórias da comunidade vão aparecer aqui.</p></div>:<div className="originals-shelf">{titles.map(item=><article className="original-card" key={item.id}>{safeCatalogUrl(item.cover_url)?<img src={item.cover_url} alt={`Capa de ${item.title}`} loading="lazy" referrerPolicy="no-referrer"/>:<span className="original-cover-placeholder"><Film size={24}/></span>}<div><span className="original-kind">{kinds[item.kind]||'Original'}</span><h2>{item.title}</h2><p>{item.synopsis}</p>{safeCatalogUrl(item.link_url)&&<a href={item.link_url} target="_blank" rel="noopener noreferrer" className="original-link">Conhecer a obra</a>}</div></article>)}</div>}
    <dialog ref={dialog} className="catalog-dialog original-dialog" aria-labelledby="new-original-title" onCancel={event=>{if(busy)event.preventDefault();}} onClick={event=>{if(event.target===dialog.current&&!busy)dialog.current.close();}}><button className="catalog-dialog-close" aria-label="Fechar cadastro de obra" onClick={()=>dialog.current?.close()} disabled={busy}><X size={20}/></button><form onSubmit={save}><span className="catalog-eyebrow">ORIGINAL TEENMAN</span><h2 id="new-original-title">Uma nova história.</h2><label>Título<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={160} required disabled={busy}/></label><label>Tipo<select value={kind} onChange={event=>setKind(event.target.value as Original['kind'])} disabled={busy}><option value="book">Livro</option><option value="movie">Filme</option><option value="series">Série</option></select></label><label>Sinopse<textarea value={synopsis} onChange={event=>setSynopsis(event.target.value)} maxLength={2000} rows={4} required disabled={busy}/></label><label>URL da capa<input type="url" value={cover} onChange={event=>setCover(event.target.value)} placeholder="https://…" maxLength={2048} required disabled={busy}/></label><label>Link da obra<input type="url" value={link} onChange={event=>setLink(event.target.value)} placeholder="https://…" maxLength={2048} required disabled={busy}/></label>{message&&<p className="vibe-message" role="status">{message}</p>}<button className="pill solid" disabled={busy}>{busy?'Cadastrando…':'Cadastrar título'}</button></form></dialog>
  </section>;
}
