'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import Mark from './mark';

function authMessage(code?: string) {
  switch (code) {
    case 'invalid_credentials': return 'E-mail ou senha incorretos. Confira e tente novamente.';
    case 'email_not_confirmed': return 'Confirme seu e-mail antes de entrar. Confira também a caixa de spam.';
    case 'user_already_exists': return 'Já existe uma conta com esse e-mail. Entre com sua senha.';
    case 'weak_password': return 'Escolha uma senha mais forte, com pelo menos 8 caracteres.';
    case 'over_email_send_rate_limit': case 'over_request_rate_limit': return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    case 'signup_disabled': return 'O cadastro está temporariamente indisponível.';
    default: return 'Não foi possível concluir. Confira os dados e tente novamente.';
  }
}
export default function Landing() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [signupMessage, setSignupMessage] = useState('');
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    // Preserve sessions created by the original localStorage-based client.
    async function restore() {
      try {
        const { data } = await supabase!.auth.getSession();
        if (data.session) { router.replace('/feed'); return; }
        const project = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
        const key = `sb-${project}-auth-token`;
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const tokens = JSON.parse(legacy);
          if (tokens.access_token && tokens.refresh_token) {
            const { error } = await supabase!.auth.setSession(tokens);
            if (!error) { localStorage.removeItem(key); router.replace('/feed'); return; }
          }
        }
      } catch { /* Unavailable legacy storage must not prevent login. */ }
      finally { if (alive) setChecking(false); }
    }
    void restore();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace('/feed');
    });
    if (new URLSearchParams(window.location.search).get('auth_error')) setMessage('O link de confirmação expirou ou não é válido. Tente entrar ou solicite um novo cadastro.');
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [router]);

  async function authenticate(event: FormEvent, signup = false) {
    event.preventDefault();
    const notify = signup ? setSignupMessage : setMessage;
    if (!supabase) { notify('A conexão está indisponível. Tente novamente mais tarde.'); return; }
    if (signup && !name.trim()) { notify('Informe seu nome.'); return; }
    setBusy(true); notify('');
    try {
      const { data, error } = signup
        ? await supabase.auth.signUp({ email: signupEmail.trim(), password: signupPassword, options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { notify(authMessage(error.code)); return; }
      setPassword(''); setSignupPassword('');
      if (data.session) { router.replace('/feed'); }
      else notify('Confira seu e-mail para confirmar o cadastro. Depois, entre com sua senha.');
    } catch { notify('Sem conexão no momento. Tente novamente.'); }
    finally { setBusy(false); }
  }
  if (checking) return <div className="auth-loading" role="status"><span className="wordmark">teenman</span><span>Preparando seu espaço…</span></div>;
  return <main className="landing">
    <section className="landing-copy" aria-labelledby="welcome-title">
      <a className="wordmark landing-brand" href="/" aria-label="Teenman início">teenman</a>
      <h1 id="welcome-title">Acontecendo<br/>agora.</h1>
      <p className="landing-subtitle">Entre no Teenman. Conecte-se, converse ao vivo e descubra filmes e histórias.</p>
      <div className="entry-controls">
        <button className="pill solid" onClick={() => { setSignupMessage(''); dialog.current?.showModal(); }}>Criar conta</button>
        <div className="divider"><span/>ou<span/></div>
        <form onSubmit={event => authenticate(event)} aria-label="Entrar no Teenman">
          <label className="sr-only" htmlFor="email">E-mail</label><input id="email" type="email" placeholder="E-mail" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} disabled={busy}/>
          <label className="sr-only" htmlFor="password">Senha</label><input id="password" type="password" placeholder="Senha" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>
          <button className="pill outline" disabled={busy || !supabase}>{busy ? 'Entrando…' : 'Entrar'}</button>
          {message && <p className="form-message" role="status">{message}</p>}
          {!supabase && <p className="form-message" role="status">A conexão está temporariamente indisponível.</p>}
        </form>
        <p className="legal">Ao criar sua conta, lembre-se: respeito, privacidade e cuidado com a comunidade fazem parte do Teenman.</p>
      </div>
    </section>
    <div className="landing-emblem"><Mark className="giant-mark"/><span className="emblem-caption">SUAS IDEIAS ENCONTRAM COMPANHIA.</span></div>
    <footer className="landing-footer"><span>Teenman © {new Date().getFullYear()}</span><span>Conecte-se. Compartilhe. Faça parte.</span></footer>
    <dialog ref={dialog} className="signup-dialog" aria-labelledby="signup-title" onClick={e => { if (e.target === dialog.current && !busy) dialog.current.close(); }} onCancel={e => { if (busy) e.preventDefault(); }}>
      <button type="button" className="close-dialog" aria-label="Fechar cadastro" disabled={busy} onClick={() => dialog.current?.close()}>×</button>
      <span className="wordmark">teenman</span><h2 id="signup-title">Crie seu espaço.</h2><p className="muted">Sua próxima conversa começa aqui.</p>
      <form onSubmit={event => authenticate(event, true)}>
        <label htmlFor="signup-name">Nome</label><input id="signup-name" value={name} onChange={e => setName(e.target.value)} required maxLength={60} autoComplete="nickname" disabled={busy}/>
        <label htmlFor="signup-email">E-mail</label><input id="signup-email" type="email" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} required autoComplete="email" disabled={busy}/>
        <label htmlFor="signup-password">Senha</label><input id="signup-password" type="password" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} minLength={8} required autoComplete="new-password" aria-describedby="password-help" disabled={busy}/><small id="password-help">Use pelo menos 8 caracteres.</small>
        {signupMessage && <p className="form-message" role="status">{signupMessage}</p>}
        <button className="pill solid" disabled={busy || !supabase}>{busy ? 'Criando conta…' : 'Criar conta'}</button>
      </form>
    </dialog>
  </main>;
}
