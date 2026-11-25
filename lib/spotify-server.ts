import 'server-only';
import { safeCover, spotifyTrackId, type Track } from './vibe';
type SpotifyTrack = { id: string; name: string; artists?: { name: string }[]; album?: { images?: { url: string }[] } };
let token: { value: string; expires: number } | null = null;
let pendingToken: Promise<string> | null = null;
export class SpotifyUnavailable extends Error { constructor(public status = 503) { super('Spotify indisponível'); } }
async function accessToken() {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) throw new SpotifyUnavailable();
  if (token && token.expires > Date.now()) return token.value;
  if (pendingToken) return pendingToken;
  pendingToken = (async () => {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials' }), cache: 'no-store', signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new SpotifyUnavailable();
    const data = await response.json();
    if (!data.access_token) throw new SpotifyUnavailable();
    token = { value: data.access_token, expires: Date.now() + Math.max(0, Number(data.expires_in) - 60) * 1000 };
    return token.value;
  })();
  try { return await pendingToken; } finally { pendingToken = null; }
}
export async function spotifyGet(path: string, retry = true): Promise<any> {
  const value = await accessToken();
  const response = await fetch(`https://api.spotify.com/v1/${path}`, { headers: { Authorization: `Bearer ${value}` }, cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (response.status === 401 && retry) { token = null; return spotifyGet(path, false); }
  if (!response.ok) throw new SpotifyUnavailable(response.status === 429 ? 429 : response.status === 404 ? 404 : 503);
  return response.json();
}
function toTrack(data: SpotifyTrack): Track { return { id: data.id, name: data.name, artist: data.artists?.map(artist => artist.name).join(', ') || '', cover: safeCover(data.album?.images?.[0]?.url) }; }
export async function searchTracks(query: string): Promise<Track[]> {
  const data = await spotifyGet(`search?${new URLSearchParams({ q: query, type: 'track', limit: '10', market: 'BR' })}`);
  return (data.tracks?.items || []).filter(Boolean).map(toTrack);
}
export async function resolveTrack(input: string): Promise<Track | null> {
  let id = spotifyTrackId(input);
  // Spotify's short links are resolved with a strict host allowlist at every hop.
  if (!id) {
    try {
      let url = new URL(input);
      for (let hop = 0; hop < 4; hop++) {
        if (url.protocol !== 'https:' || url.username || url.password || url.port || !['spotify.link', 'spoti.fi', 'open.spotify.com', 'spotify.com', 'www.spotify.com'].includes(url.hostname)) break;
        id = spotifyTrackId(url.href); if (id) break;
        const response = await fetch(url.href, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(5000) });
        const location = response.headers.get('location');
        if (!location || response.status < 300 || response.status >= 400) break;
        url = new URL(location, url);
      }
    } catch { return null; }
  }
  if (!id) return null;
  try { return toTrack(await spotifyGet(`tracks/${id}?market=BR`)); }
  catch (error) {
    if (error instanceof SpotifyUnavailable && error.status === 404) return null;
    // A valid track link still works as an official embed without API credentials.
    try {
      const response = await fetch(`https://open.spotify.com/oembed?${new URLSearchParams({ url: `https://open.spotify.com/track/${id}` })}`, { signal: AbortSignal.timeout(6000) });
      if (response.ok) { const data = await response.json(); return { id, name: String(data.title || 'Faixa no Spotify').slice(0, 300), artist: '', cover: safeCover(data.thumbnail_url) }; }
      if (response.status === 404) return null;
    } catch { /* Keep the official player usable if metadata is unavailable. */ }
    return { id, name: 'Faixa no Spotify', artist: '', cover: null };
  }
}
