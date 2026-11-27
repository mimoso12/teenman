import {createClient, type SupabaseClient} from '@supabase/supabase-js';
import * as webpush from 'web-push';
import {notificationHref, notificationLabels, type SocialNotification} from './notifications';
import {pushEndpointAllowed, validPushKeys} from './push';

export function pushAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, {auth: {persistSession: false, autoRefreshToken: false}}) : null;
}
export function pushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
type Subscription = {id: string; endpoint: string; p256dh: string; auth: string};
export async function deliverNotification(admin: SupabaseClient, notification: SocialNotification, send: typeof webpush.sendNotification = webpush.sendNotification) {
  if (notification.actor_id === notification.user_id || notification.is_read) return {sent: 0, skipped: true};
  const result = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', notification.user_id);
  if (result.error) throw new Error('subscriptions_unavailable');
  const payload = JSON.stringify({title: 'Teenman', body: `Alguém ${notificationLabels[notification.type]}.`, url: notificationHref(notification), tag: notification.id});
  let sent = 0, failed = 0;
  const subscriptions: Subscription[] = result.data || [];
  // Small batches limit outbound connections; every device gets its own claim.
  for (let offset = 0; offset < subscriptions.length; offset += 5) {
    await Promise.all(subscriptions.slice(offset, offset + 5).map(async subscription => {
      if (!pushEndpointAllowed(subscription.endpoint) || !validPushKeys(subscription.p256dh, subscription.auth)) return;
      const claim = await admin.rpc('claim_push_delivery', {notification: notification.id, subscription: subscription.id});
      if (claim.error) throw new Error('delivery_claim_failed');
      if (!claim.data) return;
      try {
        await send({endpoint: subscription.endpoint, keys: {p256dh: subscription.p256dh, auth: subscription.auth}}, payload, {
          TTL: 3600, urgency: 'normal', timeout: 8000,
          vapidDetails: {subject: process.env.VAPID_SUBJECT || 'https://teenman.vercel.app', publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY!},
        });
        sent++;
        const update = await admin.from('push_deliveries').update({status: 'sent'}).eq('notification_id', notification.id).eq('subscription_id', subscription.id);
        if (update.error) console.error('[push] Não foi possível confirmar a entrega no banco.');
      } catch (error) {
        const code = (error as {statusCode?: number}).statusCode;
        if (code === 404 || code === 410) {
          const removal = await admin.from('push_subscriptions').delete().eq('id', subscription.id);
          if (removal.error) console.error('[push] Não foi possível remover inscrição expirada.');
        } else {
          failed++;
          await admin.from('push_deliveries').update({status: 'failed'}).eq('notification_id', notification.id).eq('subscription_id', subscription.id);
          // Do not log endpoints, browser encryption keys or provider response bodies.
          console.error('[push] Provedor recusou a entrega.', {status: code || 'network'});
        }
      }
    }));
  }
  return {sent, failed};
}
