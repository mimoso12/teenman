'use client';
import {useEffect, useMemo, useState} from 'react';
import {validateMusicVibe, vibeCacheKey, type VibeResult} from '../lib/music-vibe';
import {buildRichFallbackVibe} from '../lib/rich-fallback-vibe';
import {createVibeCache} from '../lib/music-vibe-cache';
import type {Track} from '../lib/vibe';
const cache = createVibeCache(() => typeof localStorage === 'undefined' ? null : localStorage);
const pending = new Map<string, Promise<VibeResult>>();
async function analyze(track: Track): Promise<VibeResult> {
  const key = vibeCacheKey(track.name, track.artist), hit = cache.read(key);
  if (hit) return hit;
  if (pending.has(key)) return pending.get(key)!;
  const task = (async () => {
    let result: VibeResult = {...buildRichFallbackVibe(track.name, track.artist), source: 'fallback', fromAi: false};
    try {
      const response = await fetch('/api/music-vibe', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({trackName: track.name, artistName: track.artist}), signal: AbortSignal.timeout(5500)});
      if (response.ok) {const data = await response.json(), valid = validateMusicVibe(data); if (valid) result = {...valid, source: data.fromAi === true ? 'gemini' : 'fallback', fromAi: data.fromAi === true};}
    } catch { /* The immediate local scene remains active. */ }
    cache.remember(key, result); return result;
  })();
  pending.set(key, task); try {return await task;} finally {pending.delete(key);}
}
export function useMusicVibe(track: Track | null, selected: boolean, enabled: boolean, playRequest = 0) {
  const key = track ? vibeCacheKey(track.name, track.artist) : '', name = track?.name || '', artist = track?.artist || '', id = track?.id || '';
  const [entry, setEntry] = useState<{key: string; result: VibeResult} | null>(null), [loading, setLoading] = useState(false), [retry, setRetry] = useState(0);
  const fallback = useMemo<VibeResult | null>(() => selected && enabled && id ? {...buildRichFallbackVibe(name, artist), source: 'fallback', fromAi: false} : null, [selected, enabled, id, name, artist]);
  useEffect(() => {
    let active = true; setLoading(false);
    if (!selected || !enabled || !id) return;
    const known = cache.read(key); if (known) {setEntry({key, result: known}); return;}
    setLoading(true);
    void analyze({id, name, artist, cover: null}).then(result => {if (active) {setEntry({key, result}); setLoading(false);}});
    return () => {active = false;};
  }, [key, selected, enabled, name, artist, id, playRequest, retry]);
  useEffect(() => {
    let last = Date.now();
    const refresh = () => {if (id && !cache.read(key) && Date.now() - last > 15000) {last = Date.now(); setRetry(value => value + 1);}};
    window.addEventListener('online', refresh); window.addEventListener('focus', refresh);
    return () => {window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh);};
  }, [key, id]);
  return {vibe: entry?.key === key ? entry.result : fallback, loading};
}
