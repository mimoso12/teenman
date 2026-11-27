import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {pushEndpointAllowed, safePushUrl, validPushKeys} from '../lib/push';
import {deliverNotification} from '../lib/push-server';
import type {SocialNotification} from '../lib/notifications';
import * as webpush from 'web-push';

const row: SocialNotification = {id: 'notification', user_id: 'owner', actor_id: 'actor', type: 'comment', post_id: 'post', content_preview: 'Texto que não pode aparecer na tela bloqueada', is_read: false, created_at: new Date().toISOString()};
const subscription = {id: 'device', endpoint: 'https://fcm.googleapis.com/send/abc', p256dh: 'B' + 'a'.repeat(86), auth: 'a'.repeat(22)};
function admin(claim = true) {
  const calls: any[] = [];
  return {calls, client: {rpc: async (...args: any[]) => {calls.push(['rpc', ...args]); return {data: claim};}, from(table: string) {
    let operation = 'select'; const builder: any = {};
    for (const method of ['select', 'update', 'delete', 'eq']) builder[method] = (...args: any[]) => {calls.push([table, method, ...args]); if (method !== 'eq') operation = method; return builder;};
    builder.then = (resolve: any) => Promise.resolve({data: table === 'push_subscriptions' && operation === 'select' ? [subscription] : null, error: null}).then(resolve);
    return builder;
  }} as any};
}
test('push valida provedores e chaves e bloqueia SSRF/URLs externas no clique', () => {
  for (const url of [subscription.endpoint, 'https://updates.push.services.mozilla.com/wpush/v2/a', 'https://wns2-db5p.notify.windows.com/w/?token=abc', 'https://web.push.apple.com/a']) assert.equal(pushEndpointAllowed(url), true, url);
  for (const url of ['http://fcm.googleapis.com/a', 'https://fcm.googleapis.com.evil.test/a', 'https://127.0.0.1/a', 'https://localhost/a', 'https://fcm.googleapis.com:8080/a', 'https://user:pass@fcm.googleapis.com/a', 'https://evil.test.notify.windows.com.evil/a']) assert.equal(pushEndpointAllowed(url), false, url);
  assert.equal(validPushKeys(subscription.p256dh, subscription.auth), true);
  assert.equal(validPushKeys('bad', subscription.auth), false);
  for (const url of ['//evil.test', '/\\evil.test', 'https://evil.test', '/\n/evil.test']) assert.equal(safePushUrl(url), '/notifications');
  assert.equal(safePushUrl('/feed?post=abc&reply=1'), '/feed?post=abc&reply=1');
});
test('web-push instalado gera uma requisição VAPID criptografada sem acessar a rede', () => {
  const vapid = webpush.generateVAPIDKeys(), device = webpush.generateVAPIDKeys();
  const request = webpush.generateRequestDetails({endpoint: subscription.endpoint, keys: {p256dh: device.publicKey, auth: Buffer.alloc(16, 1).toString('base64url')}}, JSON.stringify({title: 'Teenman'}), {vapidDetails: {subject: 'https://teenman.vercel.app', publicKey: vapid.publicKey, privateKey: vapid.privateKey}, TTL: 3600});
  assert.equal(request.method, 'POST'); assert.equal(request.headers['Content-Encoding'], 'aes128gcm'); assert.match(String(request.headers.Authorization), /^vapid /); assert.ok(Buffer.isBuffer(request.body)); assert.ok(!request.body!.toString().includes('Teenman'));
});
test('envio usa ação persistida, privacidade na prévia e claim por dispositivo', async () => {
  const mock = admin(); let payload: any, options: any;
  const result = await deliverNotification(mock.client, row, (async (_subscription: any, data: any, settings: any) => {payload = JSON.parse(data); options = settings; return {};}) as any);
  assert.equal(result.sent, 1); assert.match(payload.body, /respondeu/); assert.ok(!payload.body.includes('Texto')); assert.equal(payload.url, '/feed?post=post&reply=1'); assert.equal(options.TTL, 3600); assert.equal(options.timeout, 8000);
  assert.ok(mock.calls.some(call => call[0] === 'rpc' && call[2].subscription === 'device'));
  assert.ok(mock.calls.some(call => call[0] === 'push_deliveries' && call[1] === 'update' && call[2].status === 'sent'));
  const duplicate = admin(false); let sends = 0;
  await deliverNotification(duplicate.client, row, (async () => {sends++;}) as any); assert.equal(sends, 0);
  await deliverNotification(mock.client, {...row, actor_id: 'owner'}, (async () => {sends++;}) as any);
  await deliverNotification(mock.client, {...row, is_read: true}, (async () => {sends++;}) as any); assert.equal(sends, 0);
});
test('410/404 removem inscrição; falha transitória preserva dispositivo para retry', async () => {
  for (const statusCode of [404, 410, 503]) {
    const mock = admin(); const original = console.error; console.error = () => {};
    try {await deliverNotification(mock.client, row, (async () => {throw {statusCode};}) as any);} finally {console.error = original;}
    assert.equal(mock.calls.some(call => call[0] === 'push_subscriptions' && call[1] === 'delete'), statusCode !== 503);
    assert.equal(mock.calls.some(call => call[0] === 'push_deliveries' && call[1] === 'update' && call[2].status === 'failed'), statusCode === 503);
  }
});
function worker() {
  const handlers = new Map<string, (event: any) => void>(), shown: any[] = [], opened: string[] = [], messages: any[] = [];
  let windows: any[] = [];
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {URL, self: {location: {origin: 'https://teenman.vercel.app'}, addEventListener: (name: string, handler: any) => handlers.set(name, handler), registration: {showNotification: async (...args: any[]) => {shown.push(args);}}, clients: {matchAll: async () => windows, openWindow: async (url: string) => {opened.push(url);}}}});
  return {shown, opened, messages, setWindows(value: any[]) {windows = value;}, async run(name: string, event: any) {let pending: Promise<any> | undefined; handlers.get(name)!({...event, waitUntil: (promise: Promise<any>) => {pending = promise;}}); await pending;}};
}
test('Service Worker mostra push com ícone, tolera JSON inválido e não abre domínio externo', async () => {
  const h = worker(); await h.run('push', {data: {json: () => ({title: 'Teenman', body: 'Alerta', url: '//evil.test', tag: '123'})}});
  assert.equal(h.shown[0][1].icon, '/icon-192.png'); assert.equal(h.shown[0][1].data.url, '/notifications');
  await h.run('push', {data: {json() {throw new Error();}}}); assert.equal(h.shown.length, 2);
  let closed = false;
  await h.run('notificationclick', {notification: {data: {url: 'https://evil.test'}, close() {closed = true;}}});
  assert.equal(closed, true); assert.deepEqual(h.opened, ['https://teenman.vercel.app/notifications']);
  let focused = false; h.setWindows([{url: 'https://teenman.vercel.app/feed', postMessage: (message: any) => h.messages.push(message), focus: async () => {focused = true;}}]);
  await h.run('notificationclick', {notification: {data: {url: '/profile/actor'}, close() {}}});
  assert.equal(focused, true); assert.equal(h.messages[0].url, '/profile/actor'); assert.equal(h.opened.length, 1);
});
