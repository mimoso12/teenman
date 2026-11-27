'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Disc3,Link2,Music2,Pin,Search,ListMusic,SkipForward,X } from 'lucide-react';
import type { Track } from '../lib/vibe';
import { useMusic } from './music-provider';
import FlyingVinyl from './flying-vinyl';
import Vinyl from './vinyl';
import SpotifyPlayer from './spotify-player';
import AddToQueue from './add-to-queue';
export default function VibeWidget(){
  const music=useMusic();
  const [showQueue,setShowQueue]=useState(false);
  const [input,setInput]=useState(''),[mode,setMode]=useState<'link'|'search'>('link');
  const [results,setResults]=useState<Track[]>([]),[finding,setFinding]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController|null>(null);
  async function find(event:FormEvent){
    event.preventDefault();if(!input.trim())return;
    request.current?.abort();const abort=new AbortController();request.current=abort;
    setFinding(true);setError('');setResults([]);
    try{
      const endpoint=mode==='link'?`/api/spotify/track?${new URLSearchParams({url:input.trim()})}`:`/api/spotify/search?${new URLSearchParams({q:input.trim()})}`;
      const response=await fetch(endpoint,{signal:abort.signal});const data=await response.json();
      if(!response.ok){setError(data.error||'Não foi possível buscar a faixa.');return;}
      if(data.track)music.selectTrack(data.track);else{setResults(data.tracks||[]);if(!data.tracks?.length)setError('Nenhuma faixa encontrada.');}
    }catch{if(!abort.signal.aborted)setError('Não foi possível conectar ao Spotify. Tente novamente.');}
    finally{if(!abort.signal.aborted)setFinding(false);}
  }
  return <FlyingVinyl playing={music.playing} cover={music.track?.cover||null} trackName={music.track?.name||''} openSignal={music.openSignal}>
    <section className="vibe-widget" aria-label="Ouvindo / Vibe Atual">
      <header className="vibe-heading"><span className="vibe-kicker"><Music2 size={13}/> SUA TRILHA, SEU MUNDO</span><h2>Ouvindo / Vibe Atual</h2><span className="vibe-play-state">{music.playing?'Tocando neste player':'Sua música acompanha a navegação'}</span></header>
      <Vinyl cover={music.track?.cover||null} name={music.track?.name||''} playing={music.playing}/>
      <div className="vibe-track-info"><h3>{music.track?.name||'Qual é a sua trilha de hoje?'}</h3><p>{music.track?.artist||'Escolha uma faixa no Spotify.'}</p></div>
      {music.track&&<SpotifyPlayer trackId={music.track.id} onPlaying={music.setPlaying} playRequest={music.playRequest} onEnded={()=>music.playNext()}/>}
      <div className="up-next-controls"><button className="pill outline" disabled={!music.queue.length} onClick={()=>music.playNext()}><SkipForward size={16}/>Próxima</button><button className="pill outline" aria-expanded={showQueue} onClick={()=>setShowQueue(value=>!value)}><ListMusic size={16}/>Fila ({music.queue.length})</button></div>
      {showQueue&&<section className="up-next-panel" aria-label="A seguir na fila"><header><h3>A seguir na fila</h3><button disabled={!music.queue.length} onClick={music.clearQueue}>Limpar fila</button></header>{!music.queue.length?<p>Adicione músicas com + Fila para ouvir em sequência.</p>:<ol>{music.queue.map((track,index)=><li key={track.id+':'+index}><button className="up-next-track" aria-label={`Tocar agora ${track.name}`} onClick={()=>music.playNext(index)}>{track.cover&&<img src={track.cover} alt="" onError={event=>{event.currentTarget.hidden=true;}}/>}<span><strong>{track.name}</strong><small>{track.artist}</small></span></button><button aria-label={`Remover ${track.name} da fila`} onClick={()=>music.removeFromQueue(index)}><X size={16}/></button></li>)}</ol>}</section>}
      <div className="auto-vibe-controls"><p className="gemini-vibe-badge" role="status">✨ IA Vibe: {music.vibe?`${music.vibe.vibeName}${music.vibe.source==='fallback'?' · modo local':''}`:'aguardando uma música'}{music.analyzing?' · consultando IA…':''}</p>{music.vibe?.lyricInspo&&<p className="lyric-inspiration">📖 Letra: {music.vibe.lyricInspo}</p>}<button className="effects-toggle" aria-pressed={music.effects} onClick={music.toggleEffects}>Efeitos IA: {music.effects?'ON':'OFF'}</button></div>
      {music.user&&<><div className="vibe-input-modes" role="group" aria-label="Escolher música"><button aria-pressed={mode==='link'} onClick={()=>{setMode('link');setResults([]);setError('');}}><Link2 size={14}/>Colar link</button><button aria-pressed={mode==='search'} onClick={()=>{setMode('search');setResults([]);setError('');}}><Search size={14}/>Buscar faixa</button></div><form className="vibe-search" onSubmit={find}><label className="sr-only" htmlFor="global-spotify-search">{mode==='link'?'Link de uma faixa do Spotify':'Nome da faixa ou artista'}</label><input id="global-spotify-search" value={input} onChange={event=>setInput(event.target.value)} placeholder={mode==='link'?'Cole o link da faixa':'Nome da música ou artista'} maxLength={mode==='link'?2048:120} disabled={finding}/><button className="pill solid" disabled={finding||!input.trim()}>{finding?'Buscando…':'Escolher música'}</button></form>{results.length>0&&<ul className="spotify-results">{results.map(track=><li key={track.id}><button onClick={()=>{music.selectTrack(track);setResults([]);}}>{track.cover?<img src={track.cover} alt=""/>:<Disc3 size={28}/>}<span><strong>{track.name}</strong><small>{track.artist}</small></span></button><AddToQueue track={track}/></li>)}</ul>}<button className="pill outline pin-vibe" disabled={!music.track||music.status==='saving'} onClick={music.pinTrack}><Pin size={15}/>{music.status==='saving'?'Salvando…':'Fixar no meu perfil'}</button><p className="vibe-save-state" role="status">{music.status==='saved'?'Música e vibe salvas no perfil.':music.message||'A IA escolhe automaticamente o clima da faixa.'}</p><Link className="vibe-profile-link" href="/profile">Ver meu perfil</Link></>}
      {error&&<p className="vibe-message" role="status">{error}</p>}
    </section>
  </FlyingVinyl>;
}
