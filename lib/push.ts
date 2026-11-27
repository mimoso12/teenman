// Shared validation; this module never imports server credentials.
export const pushEndpointAllowed = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash &&
      (!url.port || url.port === '443') &&
      (['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname) ||
        url.hostname.endsWith('.notify.windows.com') || url.hostname.endsWith('.push.apple.com'));
  } catch { return false; }
};
export function validPushKeys(p256dh: unknown, auth: unknown) {
  return typeof p256dh === 'string' && /^B[A-Za-z0-9_-]{86}={0,1}$/.test(p256dh) &&
    typeof auth === 'string' && /^[A-Za-z0-9_-]{22}={0,2}$/.test(auth);
}
export function safePushUrl(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/notifications';
  try { const parsed = new URL(value, 'https://teenman.invalid'); return parsed.origin === 'https://teenman.invalid' ? parsed.pathname + parsed.search : '/notifications'; }
  catch { return '/notifications'; }
}
export function vapidBytes(key: string) {
  const binary = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
