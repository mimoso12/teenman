import {serverSupabase} from '../../../../lib/supabase-server';
import {pushEndpointAllowed, validPushKeys} from '../../../../lib/push';
const headers = {'Cache-Control': 'private, no-store'};
export async function POST(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error: 'Origem inválida.'}, {status: 403, headers});
    const client = await serverSupabase(), user = client && (await client.auth.getUser()).data.user;
    if (!client || !user) return Response.json({error: 'Entre na sua conta.'}, {status: 401, headers});
    if (Number(request.headers.get('content-length') || 0) > 4096) return Response.json({error: 'Inscrição inválida.'}, {status: 400, headers});
    const body = await request.json();
    if (body.userId !== user.id) return Response.json({error: 'A conta mudou. Tente novamente.'}, {status: 409, headers});
    if (!pushEndpointAllowed(body.endpoint) || !validPushKeys(body.p256dh, body.auth)) return Response.json({error: 'Inscrição inválida.'}, {status: 400, headers});
    if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.PUSH_WEBHOOK_SECRET) return Response.json({error: 'O envio push ainda não foi configurado no servidor.'}, {status: 503, headers});
    const result = await client.from('push_subscriptions').upsert({user_id: user.id, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth}, {onConflict: 'endpoint'});
    if (result.error) return Response.json({error: 'Não foi possível salvar o dispositivo. Confira a configuração de push.'}, {status: 503, headers});
    return Response.json({ok: true}, {headers});
  } catch { return Response.json({error: 'Não foi possível salvar o dispositivo.'}, {status: 400, headers}); }
}
export async function DELETE(request: Request) {
  try {
    if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({}, {status: 403, headers});
    const client = await serverSupabase(), user = client && (await client.auth.getUser()).data.user;
    if (!client || !user) return Response.json({}, {status: 401, headers});
    const {endpoint} = await request.json();
    if (!pushEndpointAllowed(endpoint)) return Response.json({}, {status: 400, headers});
    const result = await client.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint);
    return Response.json({ok: !result.error}, {status: result.error ? 503 : 200, headers});
  } catch { return Response.json({}, {status: 400, headers}); }
}
