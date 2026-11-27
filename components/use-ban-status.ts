'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabase';
import {bannedMessage} from '../lib/moderation';
export function useBanStatus(userId: string) {
  const [state, setState] = useState({owner: '', banned: false, loading: true, error: ''}), version = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    if (!supabase) {setState({owner: userId, banned: false, loading: false, error: 'Não foi possível verificar as permissões da conta.'}); return;}
    try {
      const result = await supabase.from('profiles').select('is_banned').eq('id', userId).maybeSingle();
      if (result.error) throw result.error;
      if (version.current === request) setState({owner: userId, banned: result.data?.is_banned === true, loading: false, error: ''});
    } catch {if (version.current === request) setState(previous => ({...previous, owner: userId, loading: false, error: 'Não foi possível verificar as permissões da conta. Tente novamente.'}));}
  }, [userId]);
  useEffect(() => {
    void refresh();
    const channel = supabase?.channel('moderation-' + userId + '-' + Math.random().toString(36).slice(2)).on('postgres_changes', {event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId}, () => void refresh()).subscribe();
    const timer = setInterval(() => {if (!document.hidden) void refresh();}, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => {version.current++; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); if (channel) void supabase?.removeChannel(channel);};
  }, [userId, refresh]);
  const current = state.owner === userId ? state : {...state, loading: true};
  return {...current, blocked: current.loading || current.banned || Boolean(current.error), message: current.banned ? bannedMessage : current.error, refresh};
}
