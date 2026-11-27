import { createMusicVibeService } from '../../../lib/music-vibe-service';
const service = createMusicVibeService({ key: () => process.env.GEMINI_API_KEY, model: () => 'gemini-2.5-flash' });
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: 'Envie JSON.' }, { status: 415, headers });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Origem inválida.' }, { status: 403, headers });
  try {
    if (Number(request.headers.get('content-length') || 0) > 8192) return Response.json({ error: 'Dados muito longos.' }, { status: 413, headers });
    const text = await request.text();
    if (text.length > 8192) return Response.json({ error: 'Dados muito longos.' }, { status: 413, headers });
    const data = JSON.parse(text);
    if (typeof data?.trackName !== 'string' || !data.trackName.trim() || data.trackName.length > 300 || typeof data.artistName !== 'string' || data.artistName.length > 500) return Response.json({ error: 'Informe o nome da faixa e o artista.' }, { status: 400, headers });
    const result=await service.generate(data.trackName.trim(), data.artistName.trim());
    return Response.json({...result,fromAi:result.fromAi===true}, { headers });
  } catch { return Response.json({ error: 'JSON inválido.' }, { status: 400, headers }); }
}
