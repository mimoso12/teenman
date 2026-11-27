import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenVerifier} from 'livekit-server-sdk';
import {createLiveToken, LiveTokenError, livekitConfig} from '../lib/livekit-server';
const userId = '10000000-0000-4000-8000-000000000001', roomId = '20000000-0000-4000-8000-000000000001';
const config = {serverUrl: 'wss://example.livekit.cloud', apiKey: 'test-api-key', apiSecret: 'test-secret-for-local-signing-only-123456'};
function client(owner = 'other', available = true, failed = false) {
  const calls: any[] = [];
  return {calls, api: {from(table: string) {const builder: any = {}; for (const method of ['select', 'eq']) builder[method] = (...args: any[]) => {calls.push([table, method, ...args]); return builder;}; builder.maybeSingle = async () => table === 'rooms' ? {data: available ? {id: roomId, name: 'Sala real', created_by: owner} : null, error: failed ? {code: 'offline'} : null} : {data: {display_name: 'Nome do perfil', avatar_url: 'https://example.com/avatar.jpg'}, error: null}; return builder;}} as any};
}
test('JWT verificado restringe sala e identidade, expira e não concede administração', async () => {
  const mock = client(), result = await createLiveToken(mock.api, {id: userId, user_metadata: {display_name: 'Outro nome'}} as any, roomId, config);
  const claims = await new TokenVerifier(config.apiKey, config.apiSecret).verify(result.token);
  assert.equal(claims.sub, userId); assert.equal(claims.name, 'Nome do perfil'); assert.equal(claims.video?.room, 'teenman-' + roomId);
  assert.equal(claims.video?.roomJoin, true); assert.equal(claims.video?.canPublish, true); assert.equal(claims.video?.canSubscribe, true); assert.equal(claims.video?.canPublishData, true); assert.equal(claims.video?.roomAdmin, false); assert.equal(claims.video?.canUpdateOwnMetadata, false);
  assert.ok(claims.exp! - claims.nbf! <= 905); assert.equal(result.isHost, false); assert.equal(JSON.parse(claims.metadata!).isHost, false);
  assert.ok(mock.calls.some(call => call[0] === 'rooms' && call[1] === 'eq' && call[2] === 'id' && call[3] === roomId));
  await assert.rejects(() => new TokenVerifier(config.apiKey, 'incorrect-secret-that-will-not-verify').verify(result.token));
  const host = await createLiveToken(client(userId).api, {id: userId, user_metadata: {}} as any, roomId, config); assert.equal(host.isHost, true);
});
test('salas inexistentes, RLS negado, entrada inválida e configuração ausente não emitem token', async () => {
  for (const [mock, id, settings, status] of [[client(), '../arbitrary', config, 400], [client('other', false), roomId, config, 404], [client('other', false, true), roomId, config, 503], [client(), roomId, null, 503]] as const) {
    await assert.rejects(() => createLiveToken(mock.api, {id: userId} as any, id, settings), (error: any) => error instanceof LiveTokenError && error.status === status);
  }
});
test('configuração LiveKit exige WSS sem credenciais na URL e mantém chaves no servidor', () => {
  const previous = Object.fromEntries(['LIVEKIT_URL', 'NEXT_PUBLIC_LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].map(key => [key, process.env[key]]));
  try {
    process.env.LIVEKIT_API_KEY = config.apiKey; process.env.LIVEKIT_API_SECRET = config.apiSecret;
    for (const url of ['https://example.com', 'wss://user:pass@example.com', 'wss://example.com?token=secret', 'invalid']) {process.env.LIVEKIT_URL = url; assert.equal(livekitConfig(), null);}
    process.env.LIVEKIT_URL = config.serverUrl; assert.equal(livekitConfig()?.serverUrl, config.serverUrl);
    delete process.env.LIVEKIT_API_SECRET; assert.equal(livekitConfig(), null);
  } finally {for (const [key, value] of Object.entries(previous)) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}}
});
