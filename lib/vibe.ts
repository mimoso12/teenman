export type Atmosphere = 'normal' | 'rain' | 'neon' | 'cinema';
export type Track = { id: string; name: string; artist: string; cover: string | null };
export type Profile = {
  id: string; display_name: string;
  current_spotify_track_id: string | null; current_track_name: string | null;
  current_artist_name: string | null; current_album_cover: string | null;
  current_atmosphere: Atmosphere; updated_at: string;
};
export const profileColumns = 'id,display_name,current_spotify_track_id,current_track_name,current_artist_name,current_album_cover,current_atmosphere,updated_at';
export const validTrackId = (id: unknown): boolean => typeof id === 'string' && /^[a-zA-Z0-9]{22}$/.test(id);
export function spotifyTrackId(value: string): string | null {
  const input = value.trim();
  if (validTrackId(input)) return input;
  const uri = input.match(/^spotify:track:([a-zA-Z0-9]{22})$/);
  if (uri) return uri[1];
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password || !['open.spotify.com', 'spotify.com', 'www.spotify.com'].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?(?:embed\/)?track\/([a-zA-Z0-9]{22})\/?$/i);
    return match?.[1] || null;
  } catch { return null; }
}
export function safeCover(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1024) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'i.scdn.co' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function trackFromProfile(profile: Profile | null): Track | null {
  if (!profile || typeof profile.current_spotify_track_id !== 'string' || !validTrackId(profile.current_spotify_track_id)) return null;
  return { id: profile.current_spotify_track_id, name: profile.current_track_name || 'Faixa no Spotify', artist: profile.current_artist_name || '', cover: safeCover(profile.current_album_cover) };
}
