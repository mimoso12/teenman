import {AccessToken} from 'livekit-server-sdk';
import type {SupabaseClient, User} from '@supabase/supabase-js';
import {profileImage} from './profile';
import {assertNotBanned,bannedMessage} from './moderation';

export class LiveTokenError extends Error {
  constructor(public status: number, message: string) {super(message);}
}
export function livekitConfig() {
  const serverUrl = process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY, apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!serverUrl || !apiKey || !apiSecret) return null;
  try {const url = new URL(serverUrl); if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash) return null;} catch {return null;}
  return {serverUrl, apiKey, apiSecret};
}
export async function createLiveToken(client: SupabaseClient, user: User, roomId: unknown, config = livekitConfig()) {
  if (typeof roomId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) throw new LiveTokenError(400, 'Escolha uma sala válida.');
  if (!config) throw new LiveTokenError(503, 'O palco ao vivo ainda não foi configurado. O chat continua disponível.');
  try {await assertNotBanned(client,user.id);} catch(error) {throw new LiveTokenError(error instanceof Error&&error.message===bannedMessage?403:503,error instanceof Error?error.message:'Não foi possível verificar sua conta.');}
  // Uses the caller's RLS permissions. A client-supplied isHost never grants access.
  const room = await client.from('rooms').select('id,name,created_by').eq('id', roomId).maybeSingle();
  if (room.error) throw new LiveTokenError(503, 'Não foi possível verificar esta sala. Tente novamente.');
  if (!room.data) throw new LiveTokenError(404, 'Esta sala não está disponível para sua conta.');
  const profile = await client.from('profiles').select('display_name,avatar_url').eq('id', user.id).maybeSingle();
  const name = String(profile.data?.display_name || user.user_metadata?.display_name || 'Membro Teenman').replace(/[\x00-\x1f]/g, '').trim().slice(0, 80) || 'Membro Teenman';
  const isHost = room.data.created_by === user.id;
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: user.id, name, ttl: '15m', metadata: JSON.stringify({avatar: profileImage(profile.data?.avatar_url), isHost}),
  });
  token.addGrant({roomJoin: true, room: 'teenman-' + roomId.toLowerCase(), canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: false, roomAdmin: false});
  return {token: await token.toJwt(), serverUrl: config.serverUrl, isHost, participantName: name};
}
