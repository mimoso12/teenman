import {vapidBytes} from './push';
const OWNER = 'teenman_push_owner';
export function pushSupported() {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}
export async function pushRegistration() {
  await navigator.serviceWorker.register('/sw.js', {scope: '/', updateViaCache: 'none'});
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error('O dispositivo demorou a registrar as notificações. Tente novamente.')), 12000);})]);
  } finally { clearTimeout(timer); }
}
export async function savePushDevice(subscription: PushSubscription, userId: string) {
  const data = subscription.toJSON();
  const response = await fetch('/api/push/subscriptions', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({userId, endpoint: data.endpoint, p256dh: data.keys?.p256dh, auth: data.keys?.auth}), signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Não foi possível salvar o dispositivo. Tente novamente após configurar o push.');
  try { localStorage.setItem(OWNER, userId); } catch { /* Optional account hint. */ }
}
export function deviceOwner() { try { return localStorage.getItem(OWNER); } catch { return null; } }
export async function disableDevicePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    let removed = false;
    try {
      const result = await fetch('/api/push/subscriptions', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({endpoint: subscription.endpoint}), signal: AbortSignal.timeout(8000)});
      removed = result.ok;
    } catch { /* Unsubscribe also invalidates the endpoint when the server is offline. */ }
    const unsubscribed = await subscription.unsubscribe();
    if (!removed && !unsubscribed) throw new Error('Não foi possível desativar este dispositivo. Tente novamente.');
  }
  const notifications = await registration?.getNotifications();
  notifications?.forEach(notification => notification.close());
  try { localStorage.removeItem(OWNER); } catch { /* Storage may be blocked. */ }
}
export async function subscribeDevice(userId: string) {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error('As notificações ainda não foram configuradas.');
  const registration = await pushRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const existingKey = subscription.options.applicationServerKey;
    const expected = vapidBytes(key);
    if (deviceOwner() !== userId || !existingKey || !new Uint8Array(existingKey).every((value, index) => value === expected[index]) || existingKey.byteLength !== expected.byteLength) {
      await disableDevicePush(); subscription = null;
    }
  }
  subscription ||= await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: vapidBytes(key)});
  try { await savePushDevice(subscription, userId); }
  catch (error) { await subscription.unsubscribe().catch(() => false); throw error; }
}
