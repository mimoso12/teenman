import test from 'node:test';
import assert from 'node:assert/strict';
import { spotifyTrackId, safeCover, trackFromProfile } from '../lib/vibe.ts';
const id = '4uLU6hMCjMI75M1A2tKUQC';
test('aceita links de faixa compartilhados, localizados e URI', () => {
  for (const value of [`https://open.spotify.com/track/${id}?si=abc`, `https://open.spotify.com/intl-pt/track/${id}`, `https://spotify.com/track/${id}`, `https://open.spotify.com/embed/track/${id}?theme=0`, `spotify:track:${id}`]) assert.equal(spotifyTrackId(value), id);
});
test('rejeita hosts imitados, credenciais e recursos que não são faixas', () => {
  for (const value of [`https://open.spotify.com.evil.test/track/${id}`, `https://evil.test/track/${id}`, `https://user:pass@open.spotify.com/track/${id}`, `http://open.spotify.com/track/${id}`, `javascript:alert(1)`, `https://open.spotify.com/album/${id}`, `https://open.spotify.com/playlist/${id}`, 'spotify:track:curto']) assert.equal(spotifyTrackId(value), null);
});
test('capas aceitam apenas HTTPS do CDN oficial, sem credenciais', () => {
  assert.equal(safeCover('https://i.scdn.co/image/album'), 'https://i.scdn.co/image/album');
  for (const value of ['https://i.scdn.co.evil.test/image/a', 'http://i.scdn.co/image/a', 'https://secret@i.scdn.co/image/a', 'data:image/svg+xml,<svg/>', null]) assert.equal(safeCover(value), null);
});
test('perfil vazio não gera player e metadata ausente tem fallback', () => {
  assert.equal(trackFromProfile(null), null);
  assert.equal(trackFromProfile({current_spotify_track_id: null}), null);
  assert.deepEqual(trackFromProfile({current_spotify_track_id:id,current_album_cover:'https://evil.test/a.jpg'}), {id,name:'Faixa no Spotify',artist:'',cover:null});
});
