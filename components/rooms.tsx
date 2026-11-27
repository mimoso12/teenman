'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent, type Dispatch, type SetStateAction } from 'react';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, Hash, Plus, Radio, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import dynamic from 'next/dynamic';
import ReportButton from './report-button';
import {useBanStatus} from './use-ban-status';
import {assertNotBanned} from '../lib/moderation';
const LiveStage=dynamic(()=>import('./live-stage'),{ssr:false,loading:()=> <p className="social-status">Preparando palco…</p>});
export type Room = { id: string; name: string; created_by: string; created_at: string };
type Message = { id: string; room_id: string; author_id: string; author_name: string; content: string; created_at: string };
export default function Rooms({ user, activeRoom, setActiveRoom, onRooms }: { user: User; activeRoom: string | null; setActiveRoom: Dispatch<SetStateAction<string | null>>; onRooms: Dispatch<SetStateAction<Room[]>> }) {
  const ban=useBanStatus(user.id);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(0);
  const end = useRef<HTMLDivElement>(null);
  const loadRooms = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('created_at', { ascending: false }).limit(50);
      setReady(!error);
      if (!error) { setRooms(data || []); onRooms(data || []); }
    } catch { setError('Não foi possível conectar às salas. Tente novamente.'); }
    finally { setLoading(false); }
  }, [onRooms]);
  useEffect(() => {
    if(ban.blocked)return;
    void loadRooms();
    if (!supabase) return;
    const channel = supabase.channel('rooms-directory').on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => void loadRooms()).subscribe();
    return () => { void supabase!.removeChannel(channel); };
  }, [loadRooms,ban.blocked]);
  const loadMessages = useCallback(async () => {
    if (!activeRoom || !supabase || ban.blocked) return;
    try {
      const { data, error } = await supabase.from('room_messages').select('*').eq('room_id', activeRoom).order('created_at', { ascending: false }).limit(100);
      if (error) setError('Não foi possível carregar a conversa.');
      else setMessages((data || []).reverse());
    } catch { setError('Sem conexão. Tente novamente.'); }
  }, [activeRoom,ban.blocked]);
  useEffect(() => {
    setMessages([]); setConnected(false); setOnline(0); setError(''); setText('');
    if (!activeRoom || !supabase || ban.blocked) return;
    let alive = true;
    const channel = supabase.channel(`room-${activeRoom}`, { config: { presence: { key: user.id } } });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${activeRoom}` }, () => void loadMessages());
    channel.on('presence', { event: 'sync' }, () => { if (alive) setOnline(Object.keys(channel.presenceState()).length); });
    channel.subscribe(status => {
      if (!alive) return;
      setConnected(status === 'SUBSCRIBED');
      if (status === 'SUBSCRIBED') { void loadMessages(); void channel.track({ online_at: new Date().toISOString() }); }
    });
    void loadMessages();
    return () => { alive = false; void supabase!.removeChannel(channel); };
  }, [activeRoom, loadMessages, user.id,ban.blocked]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  async function create(event: FormEvent) {
    event.preventDefault(); if (!supabase || !name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await assertNotBanned(supabase,user.id);
      const { data, error } = await supabase.from('rooms').insert({ name: name.trim(), created_by: user.id }).select().single();
      if (error) setError('Não foi possível criar a sala. Tente novamente.');
      else { setName(''); await loadRooms(); setActiveRoom(data.id); }
    } catch { setError('Sem conexão. Tente novamente.'); }
    finally { setBusy(false); }
  }
  async function send(event: FormEvent) {
    event.preventDefault(); if (!supabase || !text.trim() || busy || !activeRoom) return;
    setBusy(true); setError('');
    try {
      await assertNotBanned(supabase,user.id);
      const { error } = await supabase.from('room_messages').insert({ room_id: activeRoom, author_id: user.id, author_name: String(user.user_metadata?.display_name || 'Membro Teenman'), content: text.trim() });
      if (error) setError('Não foi possível enviar. Sua mensagem foi mantida.');
      else { setText(''); await loadMessages(); }
    } catch { setError('Sem conexão. Sua mensagem foi mantida.'); }
    finally { setBusy(false); }
  }
  if(ban.blocked)return <section className="moderation-notice" role="status"><p>{ban.loading?'Verificando acesso às salas…':ban.message}</p>{!ban.loading&&!ban.banned&&<button className="pill outline" onClick={()=>void ban.refresh()}>Tentar novamente</button>}</section>;
  if (loading) return <p className="social-status" role="status">Carregando salas…</p>;
  if (!ready) return <div className="social-empty"><Radio/><h2>As salas ainda não estão disponíveis.</h2><p>Este espaço de conversas está sendo preparado. Volte em breve.</p><button className="pill outline" onClick={() => { setLoading(true); void loadRooms(); }}>Tentar novamente</button></div>;
  const room = rooms.find(item => item.id === activeRoom);
  return <section className="rooms-area">
    {error && <p className="social-message" role="status">{error}</p>}
    {room ? <><header className="room-header"><button aria-label="Voltar para salas" onClick={() => setActiveRoom(null)}><ArrowLeft size={20}/></button><Hash size={21}/><div><h1>{room.name}</h1><small>{connected ? `${online} ${online === 1 ? 'pessoa online' : 'pessoas online'} · Chat em tempo real` : 'Conectando ao chat…'}</small></div><ReportButton targetType="room" targetId={room.id}/><button className="room-refresh" onClick={() => void loadMessages()}>Atualizar</button></header><LiveStage key={user.id+room.id} roomId={room.id}/><div className="room-messages" aria-live="polite" aria-label="Mensagens da sala">{messages.length === 0 && <p className="muted">A conversa começa aqui. Diga um oi!</p>}{messages.map(item => <article className={`chat-message${item.author_id === user.id ? ' own' : ''}`} key={item.id}><strong>{item.author_name}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><p>{item.content}</p></article>)}<div ref={end}/></div><form className="room-send" onSubmit={send}><label className="sr-only" htmlFor="room-message">Mensagem para a sala</label><input id="room-message" placeholder={`Conversar em ${room.name}`} value={text} onChange={e => setText(e.target.value)} maxLength={1000} required disabled={busy}/><button className="pill blue" disabled={busy || !text.trim()} aria-label="Enviar mensagem"><Send size={18}/></button></form></> : <><div className="section-title"><h1>Salas ao Vivo</h1><p>Converse por texto, voz, câmera e compartilhamento de tela.</p></div><form className="create-room" onSubmit={create}><label className="sr-only" htmlFor="new-room">Nome da nova sala</label><input id="new-room" placeholder="Nome da sua sala" maxLength={60} value={name} onChange={e => setName(e.target.value)} required/><button className="pill solid" disabled={busy || !name.trim()}><Plus size={16}/>Criar sala</button></form>{rooms.length === 0 && <div className="social-empty"><Radio/><h2>Abra a primeira conversa.</h2><p>Crie uma sala para falar sobre um filme, livro ou assunto que você adora.</p></div>}{rooms.map(item => <button className="room-list-item" key={item.id} onClick={() => setActiveRoom(item.id)}><span className="room-symbol"><Hash size={25}/></span><span><strong>{item.name}</strong><small>Chat da comunidade</small></span><span className="room-enter">Entrar</span></button>)}</>}
  </section>;
}
