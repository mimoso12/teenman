'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {supabase} from '../lib/supabase';
import {bannedMessage,readBanStatus} from '../lib/moderation';
export function useBanStatus(userId: string) {
  const [state, setState] = useState({owner: '', banned: false, loading: true, error: ''}), version = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    const banned = supabase ? await readBanStatus(supabase,userId) : false;
    if (version.current === request) setState({owner: userId, banned, loading: false, error: ''});
  }, [userId]);
  useEffect(() => {
    void refresh();
    const channel = supabase?.channel('moderation-' + userId + '-' + Math.random().toString(36).slice(2)).on('postgres_changes', {event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + userId}, () => void refresh()).subscribe();
    const timer = setInterval(() => {if (!document.hidden) void refresh();}, 30000);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => {version.current++; clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); if (channel) void supabase?.removeChannel(channel);};
  }, [userId, refresh]);
  const current = state.owner === userId ? state : {...state, banned: false, loading: true, error: ''};
  return {...current, blocked: current.banned === true, message: current.banned ? bannedMessage : '', refresh};
}
