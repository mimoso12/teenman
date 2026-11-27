'use client';
import {createContext, useContext, useEffect, useState, type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {BellRing, BellOff, X} from 'lucide-react';
import {useMusic} from './music-provider';
import {deviceOwner, disableDevicePush, pushSupported, savePushDevice, subscribeDevice} from '../lib/push-device';
type State = 'checking' | 'unsupported' | 'off' | 'on' | 'blocked';
const Context = createContext<{state: State; busy: boolean; message: string; enable: () => void; disable: () => void} | null>(null);
export function PushControls() {
  const context = useContext(Context);
  if (!context) return null;
  const {state, busy, message, enable, disable} = context;
  return <section className="push-controls" aria-label="Notificações neste dispositivo"><div><strong><BellRing size={18}/>Notificações no dispositivo</strong><p>{state === 'on' ? 'Ativas neste dispositivo, mesmo fora do Teenman.' : state === 'blocked' ? 'Permissão bloqueada. Altere as permissões do site no navegador para ativar.' : state === 'unsupported' ? 'Este navegador não oferece Web Push. Use um navegador compatível em HTTPS.' : 'Receba alertas de novas interações mesmo com o site fechado.'}</p></div>{state !== 'unsupported' && state !== 'blocked' && state !== 'checking' && <button className="pill outline" disabled={busy} onClick={state === 'on' ? disable : enable}>{state === 'on' ? <BellOff size={16}/> : <BellRing size={16}/ >}{busy ? 'Aguarde…' : state === 'on' ? 'Desativar neste dispositivo' : 'Ativar Notificações no Dispositivo'}</button>}{message && <p role="status">{message}</p>}</section>;
}
export default function PushProvider({children}: {children: ReactNode}) {
  const {user, ready} = useMusic(), userId = user?.id, pathname = usePathname();
  const [state, setState] = useState<State>('checking'), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    setState('checking'); setMessage(''); setDismissed(false);
    if (!pushSupported()) {setState('unsupported'); return;}
    const inspect = async () => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (!active) return;
      if (subscription && (!userId || deviceOwner() !== userId)) await subscription.unsubscribe();
      else if (subscription && userId && Notification.permission === 'granted') {
        try {await savePushDevice(subscription, userId); if (active) setState('on'); return;}
        catch {if (active) setMessage('Não foi possível sincronizar o dispositivo. Ative novamente para tentar.');}
      }
      if (active) setState(Notification.permission === 'denied' ? 'blocked' : 'off');
    };
    void inspect().catch(() => {if (active) setState('off');});
    return () => {active = false;};
  }, [userId, ready]);
  async function enable() {
    if (!userId || busy || !pushSupported()) return;
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {setMessage('As notificações ainda não foram configuradas.'); return;}
    setBusy(true); setMessage('');
    try {
      // Permission is requested only by this explicit button click.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {setState(permission === 'denied' ? 'blocked' : 'off'); return;}
      await subscribeDevice(userId); setState('on'); setMessage('Notificações ativadas neste dispositivo.');
    } catch (error) {setState('off'); setMessage(error instanceof Error ? error.message : 'Não foi possível ativar as notificações.');}
    finally {setBusy(false);}
  }
  async function disable() {
    setBusy(true); setMessage('');
    try {await disableDevicePush(); setState('off'); setMessage('Notificações desativadas neste dispositivo.');}
    catch {setMessage('Não foi possível desativar. Tente novamente.');}
    finally {setBusy(false);}
  }
  return <Context.Provider value={{state, busy, message, enable, disable}}>{userId && pathname !== '/' && pathname !== '/notifications' && state === 'off' && !dismissed && <aside className="push-banner"><span><BellRing size={16}/>Receba suas notificações neste dispositivo.</span><button disabled={busy} onClick={() => void enable()}>{busy ? 'Aguarde…' : 'Ativar'}</button><button aria-label="Fechar aviso de notificações" onClick={() => setDismissed(true)}><X size={16}/></button>{message && <small role="status">{message}</small>}</aside>}{children}</Context.Provider>;
}
