import {safeCover, validTrackId, type Track} from './vibe';
export function queueTrack(value: Track): Track | null {
  if (!value || !validTrackId(value.id) || typeof value.name !== 'string' || typeof value.artist !== 'string') return null;
  return {id: value.id, name: value.name.slice(0, 300), artist: value.artist.slice(0, 500), cover: safeCover(value.cover)};
}
export function takeQueuedTrack(queue: Track[], index = 0) {
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) return {track: null, remaining: queue};
  return {track: queue[index], remaining: queue.slice(index + 1)};
}
export type SpotifyPlayback = {isPaused: boolean; isBuffering: boolean; position?: number; duration?: number; playingURI?: string};
export function createPlaybackMonitor(trackId: string) {
  let started = false, ended = false, lastPosition = 0, lastDuration = 0;
  return {update(data: SpotifyPlayback) {
    if (data.playingURI && !data.playingURI.endsWith(':' + trackId) && !data.playingURI.includes('/track/' + trackId)) return {playing: false, ended: false, ignore: true};
    const position = Math.max(0, Number(data.position) || 0), duration = Math.max(0, Number(data.duration) || lastDuration);
    if (!data.isPaused && !data.isBuffering && duration > 0 && position < duration - 250) started = true;
    const reachedEnd = started && !ended && !data.isBuffering && duration > 1000 &&
      (position >= duration - 100 || (data.isPaused && position === 0 && lastPosition >= duration - 100));
    if (reachedEnd) ended = true;
    lastPosition = position; lastDuration = duration;
    return {playing: !data.isPaused && !ended, ended: reachedEnd, ignore: false};
  }};
}
