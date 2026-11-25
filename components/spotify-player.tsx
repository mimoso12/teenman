'use client';
import { useEffect, useRef, useState } from 'react';
type PlaybackEvent = { data: { isPaused: boolean; isBuffering: boolean; position?: number } };
type Controller = { addListener(name: string, callback: (event: PlaybackEvent) => void): void; play(): void; destroy(): void };
type IframeAPI = { createController(element: HTMLElement, options: { url: string; width: string; height: number }, callback: (controller: Controller) => void): void };
declare global { interface Window { onSpotifyIframeApiReady?: (api: IframeAPI) => void } }
let api: IframeAPI | null = null;
let apiPromise: Promise<IframeAPI> | null = null;
function loadAPI(): Promise<IframeAPI> {
  if (api) return Promise.resolve(api);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => { apiPromise = null; reject(new Error('Spotify timeout')); }, 12000);
    window.onSpotifyIframeApiReady = value => { api = value; clearTimeout(timeout); resolve(value); };
    document.getElementById('teenman-spotify-api')?.remove();
    const script = document.createElement('script'); script.id = 'teenman-spotify-api'; script.src = 'https://open.spotify.com/embed/iframe-api/v1'; script.async = true;
    script.onerror = () => { clearTimeout(timeout); apiPromise = null; reject(new Error('Spotify unavailable')); };
    document.head.append(script);
  });
  return apiPromise;
}
export default function SpotifyPlayer({ trackId, onPlaying, onProgress, playRequest=0 }: { trackId: string; onPlaying: (value: boolean) => void; onProgress?: (position: number) => void;playRequest?:number }) {
  const controllerRef=useRef<Controller|null>(null),latestPlay=useRef(playRequest),consumedPlay=useRef(0),readyRef=useRef(false);
  latestPlay.current=playRequest;
  useEffect(()=>{if(playRequest>consumedPlay.current&&readyRef.current&&controllerRef.current){consumedPlay.current=playRequest;try{controllerRef.current.play();}catch{}}},[playRequest]);
  const container = useRef<HTMLDivElement>(null);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false, controller: Controller | null = null;
    let readyTimeout: ReturnType<typeof setTimeout>;
    readyRef.current=false;controllerRef.current=null;
    setFallback(false); setLoading(true); onPlaying(false);
    const target = document.createElement('div'); container.current?.replaceChildren(target);
    void loadAPI().then(value => {
      if (disposed) return;
      readyTimeout = setTimeout(() => { if (!disposed) { controller?.destroy(); setFallback(true); setLoading(false); onPlaying(false); } }, 15000);
      value.createController(target, { url: `https://open.spotify.com/track/${trackId}?utm_source=generator&theme=0`, width: '100%', height: 152 }, created => {
        if (disposed) { created.destroy(); return; }
        controller = created;controllerRef.current=created;
        created.addListener('ready', () => { clearTimeout(readyTimeout); if (!disposed) {setLoading(false);readyRef.current=true;if(latestPlay.current>consumedPlay.current){consumedPlay.current=latestPlay.current;try{created.play();}catch{}}} });
        created.addListener('playback_update', event => { if (!disposed) { onPlaying(!event.data.isPaused && !event.data.isBuffering); onProgress?.(Math.max(0, Number(event.data.position) || 0)); } });
      });
    }).catch(() => { if (!disposed) { setFallback(true); setLoading(false); } });
    return () => { disposed = true;readyRef.current=false;controllerRef.current=null; clearTimeout(readyTimeout); controller?.destroy(); target.remove(); onPlaying(false); };
  }, [trackId, onPlaying, onProgress]);
  return <div className="spotify-player">
    {loading && <span className="spotify-loading" role="status">Carregando player…</span>}
    <div ref={container} style={{ display: fallback ? 'none' : undefined }}/>
    {fallback && <><iframe title="Player oficial do Spotify" src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`} width="100%" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"/><small>Player simples ativo. O disco fica parado neste modo.</small></>}
  </div>;
}
