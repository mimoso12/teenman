'use client';
import {useEffect, useRef, useState} from 'react';
import {createPlaybackMonitor, type SpotifyPlayback} from '../lib/music-queue';
type PlaybackEvent = {data: SpotifyPlayback};
type Controller = {addListener(name: string, callback: (event: PlaybackEvent) => void): void; play(): void; seek(seconds: number): void; loadUri(uri: string): void; destroy(): void};
type IframeAPI = {createController(element: HTMLElement, options: {url: string; width: string; height: number}, callback: (controller: Controller) => void): void};
declare global {interface Window {onSpotifyIframeApiReady?: (api: IframeAPI) => void}}
let api: IframeAPI | null = null, apiPromise: Promise<IframeAPI> | null = null;
function loadAPI(): Promise<IframeAPI> {
  if (api) return Promise.resolve(api);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {apiPromise = null; reject(new Error('Spotify timeout'));}, 12000);
    window.onSpotifyIframeApiReady = value => {api = value; clearTimeout(timeout); resolve(value);};
    document.getElementById('teenman-spotify-api')?.remove();
    const script = document.createElement('script'); script.id = 'teenman-spotify-api'; script.src = 'https://open.spotify.com/embed/iframe-api/v1'; script.async = true;
    script.onerror = () => {clearTimeout(timeout); apiPromise = null; reject(new Error('Spotify unavailable'));}; document.head.append(script);
  });
  return apiPromise;
}
export default function SpotifyPlayer({trackId, onPlaying, onProgress, onEnded, playRequest = 0}: {trackId: string; onPlaying: (value: boolean) => void; onProgress?: (position: number) => void; onEnded?: () => void; playRequest?: number}) {
  const latest = useRef({trackId, onPlaying, onProgress, onEnded, playRequest}); latest.current = {trackId, onPlaying, onProgress, onEnded, playRequest};
  const container = useRef<HTMLDivElement>(null), controller = useRef<Controller | null>(null), loaded = useRef(''), consumed = useRef(0), ready = useRef(false), ended = useRef(false), monitor = useRef(createPlaybackMonitor(trackId));
  const [fallback, setFallback] = useState(false), [loading, setLoading] = useState(true);
  function sync() {
    const current = controller.current, next = latest.current; if (!current || !ready.current) return;
    try {
      if (loaded.current !== next.trackId) {loaded.current = next.trackId; monitor.current = createPlaybackMonitor(next.trackId); ended.current = false; current.loadUri('spotify:track:' + next.trackId); next.onPlaying(false);}
      if (next.playRequest > consumed.current) {
        consumed.current = next.playRequest;
        if (ended.current) {current.seek(0); monitor.current = createPlaybackMonitor(next.trackId); ended.current = false;}
        current.play();
      }
    } catch { /* The official player remains available for a manual tap. */ }
  }
  useEffect(() => {sync();}, [trackId, playRequest]);
  useEffect(() => {
    let disposed = false, failed = false, created: Controller | null = null, readyTimeout: ReturnType<typeof setTimeout> | undefined;
    const target = document.createElement('div'); container.current?.replaceChildren(target);
    ready.current = false; setLoading(true); latest.current.onPlaying(false);
    void loadAPI().then(value => {
      if (disposed) return;
      readyTimeout = setTimeout(() => {if (!disposed) {failed = true; ready.current = false; controller.current = null; created?.destroy(); setFallback(true); setLoading(false); latest.current.onPlaying(false);}}, 15000);
      loaded.current = latest.current.trackId; monitor.current = createPlaybackMonitor(loaded.current);
      value.createController(target, {url: `https://open.spotify.com/track/${loaded.current}?utm_source=generator&theme=0`, width: '100%', height: 152}, result => {
        if (disposed || failed) {result.destroy(); return;}
        created = result; controller.current = result;
        result.addListener('ready', () => {clearTimeout(readyTimeout); if (!disposed && !failed) {ready.current = true; setLoading(false); sync();}});
        result.addListener('playback_update', event => {
          if (disposed || failed || !ready.current) return;
          const playback = monitor.current.update(event.data); if (playback.ignore) return;
          latest.current.onPlaying(playback.playing); latest.current.onProgress?.(Math.max(0, Number(event.data.position) || 0));
          if (playback.ended) {ended.current = true; latest.current.onEnded?.();}
        });
      });
    }).catch(() => {if (!disposed) {setFallback(true); setLoading(false);}});
    return () => {disposed = true; ready.current = false; controller.current = null; clearTimeout(readyTimeout); created?.destroy(); target.remove(); latest.current.onPlaying(false);};
  }, []);
  return <div className="spotify-player">{loading && <span className="spotify-loading" role="status">Carregando player…</span>}<div ref={container} style={{display: fallback ? 'none' : undefined}}/>{fallback && <><iframe title="Player oficial do Spotify" src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`} width="100%" height="152" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"/><small>Player simples ativo. Use Próxima para avançar na fila.</small></>}</div>;
}
