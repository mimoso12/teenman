import type {SupabaseClient} from '@supabase/supabase-js';
export const bannedMessage = 'Sua conta está impedida de publicar e participar das salas.';
export async function readBanStatus(client: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const result = await client.from('profiles').select('is_banned').eq('id', userId).maybeSingle();
    return !result.error && result.data?.is_banned === true;
  } catch {return false;}
}
export async function assertNotBanned(client: SupabaseClient, userId: string) {
  if (await readBanStatus(client, userId)) throw new Error(bannedMessage);
}
export type ReportTarget = 'post' | 'room';
export async function submitReport(client: SupabaseClient, input: {id: string; targetType: ReportTarget; targetId: string; reason: string}) {
  const reason = input.reason.trim();
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!['post', 'room'].includes(input.targetType) || !uuid.test(input.targetId) || !uuid.test(input.id) || reason.length < 3 || reason.length > 1000) throw new Error('Descreva o motivo com 3 a 1.000 caracteres e escolha uma publicação ou sala válida.');
  const auth = await client.auth.getUser(), user = auth.data.user;
  if (!user) throw new Error('Entre na sua conta para denunciar.');
  const result = await client.from('reports').insert({id: input.id, reporter_id: user.id, target_type: input.targetType, target_id: input.targetId, reason});
  if (!result.error) return;
  if (result.error.code === '23505') {
    const existing = await client.from('reports').select('id').eq('id', input.id).eq('reporter_id', user.id).maybeSingle();
    if (!existing.error && existing.data) return;
  }
  throw new Error('Não foi possível enviar a denúncia. O motivo foi mantido para tentar novamente.');
}
