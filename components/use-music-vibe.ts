'use client';
import { useEffect, useMemo, useState } from 'react';
import { localMusicVibe, validateMusicVibe, vibeCacheKey, type VibeResult } from '../lib/music-vibe';
import type { Track } from '../lib/vibe';
type Entry = { result: VibeResult; expires: number };
const cache = new Map<string, Entry>();
const pending = new Map<string, Promise<VibeResult>>();
const storageKey = 'teenman-music-vibes-v4-scenes';
function read(key: string): VibeResult | null {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.result;
  try {
    const entries = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const item = entries[key]; const valid = validateMusicVibe(item?.result);
    if (valid && typeof item.expires === 'number' && item.expires > Date.now()) {
      const result: VibeResult = { ...valid, source: item.result.source === 'gemini' ? 'gemini' : 'fallback' };
      cache.set(key, { result, expires: item.expires }); return result;
    }
  } catch { /* Private browsing and full storage do not block playback. */ }
  return null;
}
function remember(key: string, result: VibeResult) {
  if (cache.size >= 80) cache.delete(cache.keys().next().value!);
  cache.set(key, { result, expires: Date.now() + (result.source === 'gemini' ? 7 * 86400000 : 10 * 60000) });
  try {
    const entries = Object.entries(JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, Entry>).filter(([name, item]) => name !== key && item.expires > Date.now()).slice(-79);
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries([...entries, [key, cache.get(key)]])));
  } catch { /* The in-memory cache remains available. */ }
}
async function analyze(track: Track): Promise<VibeResult> {
  const key = vibeCacheKey(track.name, track.artist);
  const hit = read(key); if (hit) return hit;
  if (pending.has(key)) return pending.get(key)!;
  const promise = (async (): Promise<VibeResult> => {
    let result: VibeResult = { ...localMusicVibe(track.name, track.artist), source: 'fallback' };
    try {
      const response = await fetch('/api/music-vibe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackName: track.name, artistName: track.artist }), signal: AbortSignal.timeout(16000) });
      if (response.ok) { const data = await response.json(); const valid = validateMusicVibe(data); if (valid) result = { ...valid, source: data.source === 'gemini' ? 'gemini' : 'fallback' }; }
    } catch { /* Local effects work offline too. */ }
    remember(key, result); return result;
  })();
  pending.set(key, promise);
  try { return await promise; } finally { pending.delete(key); }
}
export function useMusicVibe(track: Track | null, selected: boolean, enabled: boolean) {
  const key = track ? vibeCacheKey(track.name, track.artist) : '';
  const [entry, setEntry] = useState<{ key: string; result: VibeResult } | null>(null);
  const [loading, setLoading] = useState(false);
  const name = track?.name || '', artist = track?.artist || '', id = track?.id || '';
  const fallback=useMemo(()=>selected&&enabled&&id?{...localMusicVibe(name,artist),source:'fallback' as const}:null,[selected,enabled,id,name,artist]);
  useEffect(() => {
    let active = true; setLoading(false);
    if (!selected || !enabled || !id) return;
    const known = read(key);
    if (known) { setEntry({ key, result: known }); return; }
    setLoading(true);
    void analyze({ id, name, artist, cover: null }).then(result => { if (active) { setEntry({ key, result }); setLoading(false); } });
    return () => { active = false; };
  }, [key, selected, enabled, name, artist, id]);
  return { vibe: entry?.key === key ? entry.result : fallback, loading };
}
