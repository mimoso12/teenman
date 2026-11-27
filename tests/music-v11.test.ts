import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRichFallbackVibe} from '../lib/rich-fallback-vibe';
import {createVibeCache, musicVibeStorageKey} from '../lib/music-vibe-cache';
import {vibeCacheKey, validateMusicVibe, type VibeResult} from '../lib/music-vibe';
import {createMusicVibeService} from '../lib/music-vibe-service';
import {createPlaybackMonitor, queueTrack, takeQueuedTrack} from '../lib/music-queue';
function storage() {
  const data = new Map<string, string>();
  return {data, get length() {return data.size;}, key: (index: number) => [...data.keys()][index] ?? null, getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => {data.set(key, value);}, removeItem: (key: string) => {data.delete(key);}, clear: () => data.clear()} as Storage & {data: Map<string, string>};
}
test('v11 limpa caches antigos e nunca persiste fallback, inclusive se source disser gemini', () => {
  const store = storage(); store.setItem('music_vibe_v10_cache', 'old'); store.setItem('other-app', 'keep');
  let now = 100; const cache = createVibeCache(() => store, () => now), key = vibeCacheKey('Faixa', 'Banda');
  assert.equal(cache.read(key), null); assert.equal(store.getItem('music_vibe_v10_cache'), null); assert.equal(store.getItem('other-app'), 'keep');
  const vibe: VibeResult = {...buildRichFallbackVibe('Faixa', 'Banda'), source: 'fallback', fromAi: false};
  cache.remember(key, vibe); cache.remember(key, {...vibe, source: 'gemini'}); assert.equal(store.getItem(musicVibeStorageKey), null); assert.equal(cache.read(key), null);
  cache.remember(key, {...vibe, source: 'gemini', fromAi: true}); assert.equal(cache.read(key)?.fromAi, true);
  assert.equal(createVibeCache(() => store, () => now).read(key)?.source, 'gemini');
  now += 8 * 86400000; assert.equal(cache.read(key), null);
  const unavailable = createVibeCache(() => {throw new Error('blocked');}); assert.doesNotThrow(() => unavailable.remember(key, {...vibe, fromAi: true}));
});
test('fallback é determinístico, reconhece universos e varia a composição entre músicas', () => {
  const cases = [['Christmas', 'Pentatonix', 'christmas-village'], ['Ghostbusters', 'Ray Parker Jr.', 'ghostbusters-show'], ['Join Us for a Bite', 'JT Music', 'fnaf-pizzeria'], ['Evidências', 'Chitãozinho & Xororó', 'country-ranch'], ['Nosso Quadro', 'Ana Castela', 'sertanejo-arena'], ['Numb', 'Linkin Park', 'metal-hellfire-stage'], ['Bohemian Rhapsody', 'Queen', 'classic-rock-stage']];
  for (const [track, artist, horizon] of cases) {const vibe = buildRichFallbackVibe(track, artist); assert.ok(validateMusicVibe(vibe)); assert.equal(vibe.horizonSilhouette, horizon); assert.deepEqual(buildRichFallbackVibe(track, artist), vibe);}
  const signatures = new Set(Array.from({length: 1000}, (_, index) => {const vibe = buildRichFallbackVibe('Faixa ' + index, 'Banda desconhecida'); return JSON.stringify([vibe.visualSeed, vibe.primaryColor, vibe.skyEffect, vibe.skyFlyer]);}));
  assert.equal(signatures.size, 1000);
  assert.notEqual(buildRichFallbackVibe('Faixa A', 'Pentatonix').primaryColor, buildRichFallbackVibe('Faixa B', 'Pentatonix').primaryColor);
});
test('falha temporária não prende a faixa no fallback e apenas sucesso Gemini é cacheado', async () => {
  let calls = 0;
  const service = createMusicVibeService({key: () => 'test-key', timeoutMs: 30, lyrics: async () => ({lyrics: null, status: 'unavailable', url: null}), fetcher: async () => {
    calls++; if (calls === 1) return new Promise<Response>(resolve => setTimeout(() => resolve(Response.json({})), 80));
    return Response.json({candidates: [{content: {parts: [{text: JSON.stringify(buildRichFallbackVibe('Faixa', 'Banda'))}]}}]});
  }});
  const fallback = await service.generate('Faixa', 'Banda'); assert.equal(fallback.fromAi, false);
  const success = await service.generate('Faixa', 'Banda'); assert.equal(success.fromAi, true);
  assert.deepEqual(await service.generate('Faixa', 'Banda'), success); assert.equal(calls, 2);
});
test('fila suporta repetição intencional, salto, remoção e entrada inválida sem mutar original', () => {
  const a = {id: 'a'.repeat(22), name: 'A', artist: 'Banda', cover: null}, b = {...a, id: 'b'.repeat(22), name: 'B'};
  const queue = [a, b, a]; assert.equal(queueTrack(a)?.id, a.id); assert.equal(queueTrack({...a, id: 'bad'}), null);
  assert.deepEqual(takeQueuedTrack(queue), {track: a, remaining: [b, a]}); assert.deepEqual(takeQueuedTrack(queue, 1), {track: b, remaining: [a]}); assert.equal(queue.length, 3);
  for (const index of [-1, 3, NaN, .5]) assert.equal(takeQueuedTrack(queue, index).track, null);
  assert.equal(takeQueuedTrack([]).track, null);
});
test('avanço depende de término real reportado, não de pausa, buffering ou evento de outra faixa', () => {
  const monitor = createPlaybackMonitor('a'.repeat(22));
  assert.equal(monitor.update({isPaused: true, isBuffering: false, duration: 30000, position: 30000}).ended, false);
  assert.equal(monitor.update({isPaused: false, isBuffering: false, duration: 30000, position: 1000}).playing, true);
  assert.equal(monitor.update({isPaused: false, isBuffering: true, duration: 30000, position: 1000}).playing, true);
  assert.equal(monitor.update({isPaused: true, isBuffering: false, duration: 30000, position: 15000}).ended, false);
  assert.equal(monitor.update({isPaused: true, isBuffering: false, duration: 30000, position: 30000, playingURI: 'spotify:track:other'}).ignore, true);
  assert.equal(monitor.update({isPaused: true, isBuffering: false, duration: 30000, position: 30000}).ended, true);
  assert.equal(monitor.update({isPaused: true, isBuffering: false, duration: 30000, position: 30000}).ended, false);
});
