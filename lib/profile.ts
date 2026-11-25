import type { SupabaseClient } from '@supabase/supabase-js';
import { profileColumns, type Profile } from './vibe';
import { validateMusicVibe, type VibeResult } from './music-vibe';
export type ProfileData = Profile & { username: string | null; bio: string; category: string; avatar_url: string | null; banner_url: string | null; created_at: string; current_ai_vibe: VibeResult | null };
export const fullProfileColumns = `${profileColumns},username,bio,category,avatar_url,banner_url,created_at,current_ai_vibe`;
export function normalizeProfile(value: Partial<ProfileData> & { id: string }): ProfileData {
  const valid = validateMusicVibe(value.current_ai_vibe);
  return { display_name:'Membro Teenman',current_spotify_track_id:null,current_track_name:null,current_artist_name:null,current_album_cover:null,current_atmosphere:'normal',updated_at:'',username:null,bio:'',category:'',avatar_url:null,banner_url:null,created_at:'',...value,current_ai_vibe: valid ? {...valid,source:value.current_ai_vibe?.source === 'gemini' ? 'gemini':'fallback'}:null };
}
export async function fetchProfile(client: SupabaseClient, id: string) {
  const full = await client.from('profiles').select(fullProfileColumns).eq('id',id).maybeSingle();
  if (!full.error) return { profile: full.data ? normalizeProfile(full.data as unknown as ProfileData) : null, enhanced:true, error:null };
  const basic = await client.from('profiles').select(profileColumns).eq('id',id).maybeSingle();
  return { profile: basic.data ? normalizeProfile(basic.data as unknown as ProfileData) : null, enhanced:false, error:basic.error };
}
export function profileImage(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  try { const url=new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href:null; } catch { return null; }
}
export function isAllowedProfileImage(file:Pick<File,'type'|'size'>):boolean{return ['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)&&file.size>0&&file.size<=5*1024*1024;}
