import {validateMusicVibe, type VibeResult} from './music-vibe';
export const musicVibeStorageKey = 'music_vibe_v11_cache';
type Entry = {result: VibeResult; expires: number};
export function createVibeCache(storage: () => Storage | null, now = Date.now) {
  const memory = new Map<string, Entry>();
  let cleaned = false;
  function read(key: string): VibeResult | null {
    if (!cleaned) {cleaned = true; try {const store = storage(); if (store) for (let index = store.length - 1; index >= 0; index--) {const name = store.key(index); if (name && /^music_vibe_v(?:[0-9]|10)_/.test(name)) store.removeItem(name);}} catch {}}
    const hit = memory.get(key); if (hit && hit.expires > now() && hit.result.fromAi === true) return hit.result;
    try {
      const item = JSON.parse(storage()?.getItem(musicVibeStorageKey) || '{}')[key], valid = validateMusicVibe(item?.result);
      if (valid && item.result.fromAi === true && item.expires > now()) {
        const result: VibeResult = {...valid, source: 'gemini', fromAi: true}; memory.set(key, {result, expires: item.expires}); return result;
      }
    } catch {}
    return null;
  }
  function remember(key: string, result: VibeResult) {
    if (result.fromAi !== true || !validateMusicVibe(result)) return;
    if (memory.size >= 80) memory.delete(memory.keys().next().value!);
    const entry = {result, expires: now() + 7 * 86400000}; memory.set(key, entry);
    try {
      const store = storage(); if (!store) return;
      const entries = Object.entries(JSON.parse(store.getItem(musicVibeStorageKey) || '{}') as Record<string, Entry>).filter(([name, item]) => name !== key && item?.result?.fromAi === true && item.expires > now()).slice(-79);
      store.setItem(musicVibeStorageKey, JSON.stringify(Object.fromEntries([...entries, [key, entry]])));
    } catch { /* Optional persistence never blocks the visual. */ }
  }
  return {read, remember};
}
