import {serverSupabase} from '../../../../lib/supabase-server';
import {createLiveToken, LiveTokenError} from '../../../../lib/livekit-server';
export const runtime = 'nodejs';
const headers = {'Cache-Control': 'private, no-store', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff'};
async function handle(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if ((request.method === 'POST' || origin) && origin !== new URL(request.url).origin) return Response.json({error: 'Origem inválida.'}, {status: 403, headers});
    const client = await serverSupabase(), user = client && (await client.auth.getUser()).data.user;
    if (!client || !user) return Response.json({error: 'Entre na sua conta para participar do palco.'}, {status: 401, headers});
    let roomId: unknown;
    if (request.method === 'GET') roomId = new URL(request.url).searchParams.get('roomId');
    else {
      const body = await request.text();
      if (body.length > 2048) return Response.json({error: 'Dados inválidos.'}, {status: 400, headers});
      try {roomId = JSON.parse(body)?.roomId;} catch {return Response.json({error: 'Dados inválidos.'}, {status: 400, headers});}
    }
    return Response.json(await createLiveToken(client, user, roomId), {headers});
  } catch (error) {
    const known = error instanceof LiveTokenError;
    if (!known) console.error('[livekit] Não foi possível criar acesso ao palco.');
    return Response.json({error: known ? error.message : 'O palco está indisponível. Tente novamente.'}, {status: known ? error.status : 503, headers});
  }
}
export const GET = handle;
export const POST = handle;
