import {timingSafeEqual} from 'node:crypto';
import {serverSupabase} from '../../../../lib/supabase-server';
import {deliverNotification, pushAdmin, pushConfigured} from '../../../../lib/push-server';
import {normalizeNotification, notificationTypes} from '../../../../lib/notifications';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = {'Cache-Control': 'private, no-store'};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function trustedWebhook(request: Request) {
  const expected = process.env.PUSH_WEBHOOK_SECRET, actual = request.headers.get('x-push-secret');
  return Boolean(expected && actual && expected.length >= 32 && Buffer.byteLength(expected) === Buffer.byteLength(actual) && timingSafeEqual(Buffer.from(expected), Buffer.from(actual)));
}
export async function POST(request: Request) {
  try {
    const webhook = trustedWebhook(request);
    let actorId: string | null = null;
    if (!webhook) {
      if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error: 'Não autorizado.'}, {status: 403, headers});
      const client = await serverSupabase();
      actorId = client ? (await client.auth.getUser()).data.user?.id || null : null;
      if (!actorId) return Response.json({error: 'Entre na sua conta.'}, {status: 401, headers});
    }
    if (Number(request.headers.get('content-length') || 0) > 8192) return Response.json({error: 'Dados inválidos.'}, {status: 400, headers});
    const body = await request.json();
    const admin = pushAdmin();
    if (!admin || !pushConfigured()) return Response.json({error: 'Push ainda não configurado.'}, {status: 503, headers});
    let query = admin.from('notifications').select('id,user_id,actor_id,type,post_id,content_preview,is_read,created_at');
    if (webhook) {
      // Supabase INSERT webhook; trust only the ID, then load authoritative data.
      if (body.type !== 'INSERT' || body.table !== 'notifications' || body.schema !== 'public' || !uuid.test(body.record?.id || '')) return Response.json({error: 'Evento inválido.'}, {status: 400, headers});
      query = query.eq('id', body.record.id);
    } else {
      // The browser cannot choose arbitrary titles, URLs or recipients without a real action.
      if (!uuid.test(body.targetUserId || '') || (body.type && !notificationTypes.includes(body.type)) || (body.postId && !uuid.test(body.postId)) || (body.sourceId && !uuid.test(body.sourceId))) return Response.json({error: 'Ação inválida.'}, {status: 400, headers});
      if (body.type === 'comment' && !uuid.test(body.sourceId || '')) return Response.json({error: 'Resposta inválida.'}, {status: 400, headers});
      query = query.eq('actor_id', actorId!).eq('user_id', body.targetUserId).gte('created_at', new Date(Date.now() - 5 * 60000).toISOString());
      if (body.type) query = query.eq('type', body.type);
      if (body.type || body.postId) query = body.postId ? query.eq('post_id', body.postId) : query.is('post_id', null);
      if (body.sourceId) query = query.eq('source_id', body.sourceId);
    }
    const result = await query.order('created_at', {ascending: false}).limit(1).maybeSingle();
    if (result.error) throw new Error('notification_lookup_failed');
    const notification = normalizeNotification(result.data);
    if (!notification) return Response.json({ok: true, skipped: true}, {headers});
    const delivery = await deliverNotification(admin, notification);
    return Response.json({ok: !delivery.failed, ...delivery}, {status: delivery.failed ? 503 : 200, headers});
  } catch {
    console.error('[push] Disparo indisponível; nenhuma credencial foi registrada.');
    return Response.json({error: 'Não foi possível enviar a notificação.'}, {status: 503, headers});
  }
}
