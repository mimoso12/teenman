import { serverSupabase } from '../../../../lib/supabase-server';
import { resolveTrack } from '../../../../lib/spotify-server';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const client = await serverSupabase();
  const user = client && (await client.auth.getUser()).data.user;
  if (!user) return Response.json({ error: 'Entre para escolher sua música.' }, { status: 401, headers });
  const input = new URL(request.url).searchParams.get('url')?.trim() || '';
  if (!input || input.length > 2048) return Response.json({ error: 'Informe o link de uma faixa do Spotify.' }, { status: 400, headers });
  try {
    const track = await resolveTrack(input);
    return track ? Response.json({ track }, { headers }) : Response.json({ error: 'Use o link de uma faixa do Spotify, não de um álbum ou playlist.' }, { status: 400, headers });
  } catch { return Response.json({ error: 'Não foi possível abrir a faixa. Tente novamente.' }, { status: 503, headers }); }
}
