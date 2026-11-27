'use client';
import {useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {supabase} from '../lib/supabase';
import {submitReport, type ReportTarget} from '../lib/moderation';
export default function ReportButton({targetType, targetId}: {targetType: ReportTarget; targetId: string}) {
  const [opened, setOpened] = useState(false), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null), locked = useRef(false), attempt = useRef<string | null>(null);
  useEffect(() => {if (opened) dialog.current?.showModal();}, [opened]);
  function close() {if (!locked.current) setOpened(false);}
  async function send() {
    if (locked.current || sent) return;
    locked.current = true; setBusy(true); setError('');
    try {
      if (!supabase) throw new Error('Entre na sua conta para denunciar.');
      attempt.current ||= crypto.randomUUID();
      await submitReport(supabase, {id: attempt.current, targetType, targetId, reason}); setSent(true);
    } catch (error) {setError(error instanceof Error ? error.message : 'Não foi possível enviar. Tente novamente.');}
    finally {locked.current = false; setBusy(false);}
  }
  return <><button type="button" className="report-button" onClick={() => {setReason(''); setSent(false); setError(''); attempt.current = null; setOpened(true);}}>🚨 Denunciar</button>{opened && createPortal(<dialog ref={dialog} className="report-dialog" aria-label={targetType === 'post' ? 'Denunciar publicação' : 'Denunciar sala'} onCancel={event => {event.preventDefault(); close();}} onClick={event => {if (event.target === dialog.current) close();}}><header><h2>{targetType === 'post' ? 'Denunciar publicação' : 'Denunciar sala'}</h2><button type="button" aria-label="Fechar denúncia" onClick={close} disabled={busy}><X size={20}/></button></header>{sent ? <div role="status"><p>Denúncia enviada para análise.</p><button className="pill outline" onClick={close}>Fechar</button></div> : <form onSubmit={event => {event.preventDefault(); void send();}}><label>Qual é o motivo?<textarea value={reason} onChange={event => {setReason(event.target.value); attempt.current = null;}} rows={4} minLength={3} maxLength={1000} required disabled={busy} placeholder="Descreva o que aconteceu." autoFocus/></label><small>Seu motivo não é exibido publicamente.</small>{error && <p role="alert">{error}</p>}<button className="pill solid" disabled={busy || reason.trim().length < 3}>{busy ? 'Enviando…' : 'Enviar denúncia'}</button></form>}</dialog>,document.body)}</>;
}
