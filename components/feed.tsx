'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { useRouter,useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Bell, BookOpen, Clapperboard, Heart, Home, ImagePlus, LogOut, MessageCircle, MoreHorizontal, Radio, Repeat2, Search, Send, Smile, UserRound, Video, X, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { mediaFromUrl, splitPost, userHandle } from '../lib/post-media';
import PostMedia from './post-media';
import MovieCatalog from './movie-catalog';
import Rooms, { type Room } from './rooms';

type Post = { id: string; author_id: string; author_name: string; content: string; created_at: string };
type Interaction = { post_id: string; user_id: string; author_name: string; created_at: string };
type Comment = { id: string; post_id: string; author_id: string; author_name: string; content: string; created_at: string };
type View = 'home' | 'explore' | 'rooms' | 'catalog' | 'notifications' | 'profile';
type Tab = 'for-you' | 'following' | 'rooms' | 'catalog';
const tabs: { id: Tab; label: string }[] = [{ id: 'for-you', label: 'Para você' }, { id: 'following', label: 'Seguindo' }, { id: 'rooms', label: 'Salas' }, { id: 'catalog', label: 'Filmes & Livros' }];
const navigation = [{ id: 'home', label: 'Página Inicial', icon: Home }, { id: 'explore', label: 'Explorar', icon: Search }, { id: 'rooms', label: 'Salas ao Vivo', icon: Radio }, { id: 'catalog', label: 'Filmes & Livros', icon: BookOpen }, { id: 'notifications', label: 'Notificações', icon: Bell }, { id: 'profile', label: 'Perfil', icon: UserRound }] as const;
const setupMessage = 'As interações ainda não estão disponíveis. Tente novamente mais tarde.';

function Avatar({ name, large = false }: { name: string; large?: boolean }) { return <span className={`avatar${large ? ' large' : ''}`} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>; }
export default function Feed({ initialUser }: { initialUser: User }) {
  const router = useRouter();
  const params=useSearchParams();
  const [user, setUser] = useState(initialUser);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likes, setLikes] = useState<Interaction[]>([]);
  const [reposts, setReposts] = useState<Interaction[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [socialReady, setSocialReady] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaDraft, setMediaDraft] = useState('');
  const [mediaError, setMediaError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [tab, setTab] = useState<Tab>('for-you');
  const [query, setQuery] = useState('');
  const [commentPost, setCommentPost] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const next=params.get('view')||'home';
    setView(['explore','rooms','catalog','notifications'].includes(next)?next as View:'home');
    setTab(next==='following'?'following':next==='rooms'?'rooms':next==='catalog'?'catalog':'for-you');
    setQuery(params.get('q')||'');
    if(params.get('compose'))requestAnimationFrame(()=>composer.current?.focus());
  },[params]);
  const displayName = String(user.user_metadata?.display_name || 'Membro Teenman');
  const handle = userHandle(displayName, user.id);

  const loadPosts = useCallback(async () => {
    if (!supabase) return;
    try {
      const result = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(100);
      if (result.error) { setMessage('Não foi possível carregar as publicações. Tente novamente.'); return; }
      const data = (result.data || []) as Post[];
      setPosts(data);
      const ids = data.map(post => post.id);
      const results = await Promise.all([
        supabase.from('post_likes').select('*').in('post_id', ids),
        supabase.from('post_reposts').select('*').in('post_id', ids),
        supabase.from('post_comments').select('*').in('post_id', ids).order('created_at'),
        supabase.from('follows').select('following_id').eq('follower_id', initialUser.id),
      ]);
      setSocialReady(results.every(result => !result.error));
      setLikes(results[0].data || []); setReposts(results[1].data || []); setComments(results[2].data || []);
      setFollowing((results[3].data || []).map(row => row.following_id));
    } catch { setMessage('Sem conexão. Tente atualizar o feed.'); }
    finally { setLoading(false); }
  }, [initialUser.id]);
  useEffect(() => {
    if (!supabase) { router.replace('/'); return; }
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && event === 'SIGNED_OUT') { setPosts([]); router.replace('/'); }
      else if (session) setUser(session.user);
    });
    void loadPosts();
    void supabase.from('rooms').select('*').order('created_at', { ascending: false }).limit(50).then(({ data, error }) => { if (!error) setRooms(data || []); });
    let timer: ReturnType<typeof setTimeout>;
    const channel = supabase.channel(`feed-${initialUser.id}`);
    for (const table of ['posts', 'post_likes', 'post_reposts', 'post_comments', 'follows']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { clearTimeout(timer); timer = setTimeout(() => void loadPosts(), 200); });
    }
    channel.subscribe();
    return () => { clearTimeout(timer); data.subscription.unsubscribe(); void supabase!.removeChannel(channel); };
  }, [initialUser.id, loadPosts, router]);

  useEffect(() => { const refresh = () => { void loadPosts(); }; window.addEventListener('teenman-post-created', refresh); return () => window.removeEventListener('teenman-post-created', refresh); }, [loadPosts]);
  function navigate(next: View) {
    if (next === 'profile') { router.push('/profile'); return; }
    setView(next); setQuery(''); setMessage('');
    if (next === 'home') setTab('for-you');
    if (next === 'catalog') setTab('catalog');
    if (next === 'rooms') setTab('rooms');
    if (next === 'explore') requestAnimationFrame(() => search.current?.focus());
  }
  function selectTab(next: Tab) { router.push(`/feed?view=${next==='for-you'?'home':next}`); }
  function focusComposer() { setView('home'); setTab('for-you'); requestAnimationFrame(() => { composer.current?.focus(); composer.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }); }
  async function publish(event: FormEvent) {
    event.preventDefault();
    const text = [content.trim(), mediaUrl].filter(Boolean).join('\n');
    if (!supabase || !text || busy) return;
    if (text.length > 1000) { setMessage('O texto e o link de mídia devem ter até 1.000 caracteres juntos.'); return; }
    setBusy(true); setMessage('');
    try {
      const { error } = await supabase.from('posts').insert({ author_id: user.id, author_name: displayName, content: text });
      if (error) setMessage('Não foi possível postar. Seu rascunho foi mantido.');
      else { setContent(''); setMediaUrl(''); await loadPosts(); }
    } catch { setMessage('Sem conexão. Seu rascunho foi mantido.'); }
    finally { setBusy(false); }
  }
  async function interact(post: Post, kind: 'like' | 'repost' | 'follow' | 'delete' | 'comment') {
    if (!supabase || action) return;
    if (kind !== 'delete' && !socialReady) { setMessage(setupMessage); return; }
    if (kind === 'comment' && !comment.trim()) return;
    setAction(`${post.id}-${kind}`); setMessage('');
    try {
      let error;
      if (kind === 'delete') {
        if (!window.confirm('Excluir esta publicação?')) return;
        ({ error } = await supabase.from('posts').delete().eq('id', post.id).eq('author_id', user.id));
      } else if (kind === 'comment') {
        ({ error } = await supabase.from('post_comments').insert({ post_id: post.id, author_id: user.id, author_name: displayName, content: comment.trim() }));
        if (!error) setComment('');
      } else if (kind === 'follow') {
        const exists = following.includes(post.author_id);
        ({ error } = exists ? await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', post.author_id) : await supabase.from('follows').insert({ follower_id: user.id, following_id: post.author_id }));
      } else {
        const table = kind === 'like' ? 'post_likes' : 'post_reposts';
        const exists = (kind === 'like' ? likes : reposts).some(row => row.post_id === post.id && row.user_id === user.id);
        ({ error } = exists ? await supabase.from(table).delete().eq('post_id', post.id).eq('user_id', user.id) : await supabase.from(table).insert({ post_id: post.id, user_id: user.id, author_name: displayName }));
      }
      if (error) setMessage('Não foi possível concluir. Tente novamente.');
      else await loadPosts();
    } catch { setMessage('Falha de conexão. Tente novamente.'); }
    finally { setAction(null); }
  }
  async function logout() {
    if (!supabase || leaving) return;
    setLeaving(true); setMessage('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) { setMessage('Não foi possível sair. Tente novamente.'); return; }
      router.replace('/');
    } catch { setMessage('Sem conexão. Tente sair novamente.'); }
    finally { setLeaving(false); }
  }
  const catalogPost = (post: Post) => /filme|cinema|livro|série|serie|leitura|trailer|história|historia|entretenimento/i.test(post.content) || splitPost(post.content).media?.kind === 'embed';
  const visiblePosts = posts.filter(post => {
    if (view === 'profile' && post.author_id !== user.id && !reposts.some(row => row.user_id === user.id && row.post_id === post.id)) return false;
    if (view === 'home' && tab === 'following' && !following.includes(post.author_id)) return false;
    if (view === 'catalog' && !catalogPost(post)) return false;
    return `${post.content} ${post.author_name}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
  });
  const topics = [...posts.reduce((map, post) => { for (const tag of new Set(post.content.match(/#[\p{L}\p{N}_]+/gu) || [])) map.set(tag, (map.get(tag) || 0) + 1); return map; }, new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const ownIds = new Set(posts.filter(post => post.author_id === user.id).map(post => post.id));
  const notifications = [...likes.filter(row => ownIds.has(row.post_id) && row.user_id !== user.id).map(row => ({ ...row, label: 'curtiu sua publicação', key: `like-${row.post_id}-${row.user_id}` })), ...comments.filter(row => ownIds.has(row.post_id) && row.author_id !== user.id).map(row => ({ ...row, label: 'comentou na sua publicação', key: row.id }))].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const showPosts = !['rooms', 'notifications', 'catalog'].includes(view);
  const parsedMedia = mediaUrl ? mediaFromUrl(mediaUrl) : null;

  return <>
    <main className="social-main" id="main-feed">
      <header className="social-header"><div className="social-tabs" role="tablist" aria-label="Feed">{tabs.map(item => <button key={item.id} role="tab" aria-selected={tab === item.id && ['home', 'catalog', 'rooms'].includes(view)} onClick={() => selectTab(item.id)}>{item.label}</button>)}</div></header>
      {message && <div className="social-message" role="status"><span>{message}</span><button aria-label="Fechar aviso" onClick={() => setMessage('')}><X size={18}/></button></div>}
      {['explore', 'profile', 'notifications'].includes(view) && <div className="section-title"><h1>{view === 'explore' ? 'Explorar' : view === 'profile' ? 'Seu perfil' : 'Notificações'}</h1></div>}
      {(view === 'explore' || query) && <form className="inline-search" onSubmit={e => e.preventDefault()}><Search size={19}/><input ref={search} aria-label="Buscar publicações" placeholder="Buscar pessoas e assuntos" value={query} onChange={e => setQuery(e.target.value)}/>{query && <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={17}/></button>}</form>}
      {view === 'profile' && <section className="social-profile"><div className="social-profile-cover"><span>TEENMAN</span></div><Avatar name={displayName} large/><div className="social-profile-info"><h2>{displayName}</h2><p>{handle}</p><p>Conectando ideias, filmes e boas histórias.</p><small>Membro desde {new Date(user.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</small><div><strong>{following.length}</strong> seguindo <span>·</span> <strong>{posts.filter(post => post.author_id === user.id).length}</strong> publicações no feed</div></div></section>}
      {view === 'home' && <section className="social-composer" aria-label="Nova publicação"><Avatar name={displayName}/><form onSubmit={publish}><label className="sr-only" htmlFor="post-content">O que está acontecendo?</label><textarea ref={composer} id="post-content" placeholder="O que está acontecendo?" maxLength={1000} value={content} onChange={e => setContent(e.target.value)} disabled={busy}/>{parsedMedia && <div className="composer-media"><PostMedia key={mediaUrl} media={parsedMedia}/><button type="button" aria-label="Remover mídia" onClick={() => setMediaUrl('')}><X size={18}/></button></div>}<div className="social-compose-bottom"><div className="media-tools"><button type="button" aria-label="Adicionar imagem por link" title="Imagem por link" onClick={() => { setMediaDraft(mediaUrl); setMediaError(''); dialog.current?.showModal(); }}><ImagePlus size={19}/></button><button type="button" aria-label="Adicionar vídeo ou trailer por link" title="Vídeo ou trailer por link" onClick={() => { setMediaDraft(mediaUrl); setMediaError(''); dialog.current?.showModal(); }}><Video size={19}/></button><button type="button" aria-label="Adicionar emoji" title="Adicionar emoji" onClick={() => { setContent(current => current.length < 998 ? current + ' ✨' : current); composer.current?.focus(); }}><Smile size={19}/></button></div><span className="character-count">{content.length + (mediaUrl ? mediaUrl.length + 1 : 0)}/1000</span><button className="pill solid" disabled={busy || (!content.trim() && !mediaUrl) || content.length + mediaUrl.length + (mediaUrl ? 1 : 0) > 1000}>{busy ? 'Postando…' : 'Postar'}</button></div></form></section>}
      {showPosts && <button className="show-posts" onClick={() => { setLoading(true); setMessage(''); void loadPosts(); }} disabled={loading}><RefreshCw size={14}/>{loading ? 'Carregando publicações…' : 'Atualizar publicações'}</button>}
      {view === 'catalog' && <MovieCatalog user={user}/>}
      {view === 'rooms' && <Rooms user={user} activeRoom={activeRoom} setActiveRoom={setActiveRoom} onRooms={setRooms}/>}
      {view === 'notifications' && <section className="social-notifications">{!socialReady ? <div className="social-empty"><Bell/><h2>Seu espaço de novidades.</h2><p>As interações estarão disponíveis após a atualização do banco.</p></div> : notifications.length === 0 ? <div className="social-empty"><Bell/><h2>Tudo em dia por aqui.</h2><p>Quando alguém curtir ou comentar nas suas publicações, você verá aqui.</p></div> : notifications.map(item => <button key={item.key} className="notification-row" onClick={() => { setView('home'); setTab('for-you'); setQuery(posts.find(post => post.id === item.post_id)?.content.slice(0, 35) || ''); }}><Bell size={21}/><span><strong>{item.author_name}</strong> {item.label}.<small>{new Date(item.created_at).toLocaleString('pt-BR')}</small></span></button>)}</section>}
      {showPosts && !loading && visiblePosts.length === 0 && <div className="social-empty"><Clapperboard/><h2>{query ? 'Nenhum resultado por aqui.' : tab === 'following' && view === 'home' ? 'Sua próxima conexão começa aqui.' : 'Toda conversa tem um começo.'}</h2><p>{query ? 'Tente outro nome ou assunto.' : tab === 'following' && view === 'home' ? 'Siga pessoas pelo menu de cada publicação para acompanhar suas histórias.' : view === 'catalog' ? 'Compartilhe filmes, livros e trailers para começar o catálogo da comunidade.' : 'Compartilhe uma ideia, um filme ou uma história com a comunidade.'}</p></div>}
      {showPosts && visiblePosts.map(post => {
        const parsed = splitPost(post.content);
        const liked = likes.some(row => row.post_id === post.id && row.user_id === user.id);
        const reposted = reposts.some(row => row.post_id === post.id && row.user_id === user.id);
        const postComments = comments.filter(row => row.post_id === post.id);
        return <article key={post.id} className="social-post"><Avatar name={post.author_name}/><div className="social-post-body"><div className="social-post-heading"><strong><Link href={`/profile/${post.author_id}`}>{post.author_name}</Link></strong><span className="post-handle">{userHandle(post.author_name, post.author_id)}</span><span className="post-date">· {new Date(post.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'America/Sao_Paulo' })}</span><details className="post-menu"><summary aria-label={`Opções da publicação de ${post.author_name}`}><MoreHorizontal size={20}/></summary><div>{post.author_id === user.id ? <button disabled={Boolean(action)} onClick={() => void interact(post, 'delete')}>Excluir publicação</button> : <button disabled={Boolean(action)} onClick={() => void interact(post, 'follow')}>{following.includes(post.author_id) ? 'Deixar de seguir' : 'Seguir autor'}</button>}</div></details></div>{parsed.text && <p className="social-post-text">{parsed.text}</p>}{parsed.media && <PostMedia key={parsed.media.url} media={parsed.media}/>}
          <div className="post-actions"><button aria-label={`Comentar publicação de ${post.author_name}`} aria-expanded={commentPost === post.id} onClick={() => { setCommentPost(current => current === post.id ? null : post.id); setComment(''); }}><MessageCircle size={19}/><span>{postComments.length || ''}</span></button><button className={reposted ? 'reposted' : ''} aria-label="Repostar" aria-pressed={reposted} disabled={Boolean(action)} onClick={() => void interact(post, 'repost')}><Repeat2 size={19}/><span>{reposts.filter(row => row.post_id === post.id).length || ''}</span></button><button className={liked ? 'liked' : ''} aria-label="Curtir" aria-pressed={liked} disabled={Boolean(action)} onClick={() => void interact(post, 'like')}><Heart size={19} fill={liked ? 'currentColor' : 'none'}/><span>{likes.filter(row => row.post_id === post.id).length || ''}</span></button><button aria-label="Copiar publicação" onClick={async () => { try { await navigator.clipboard.writeText(post.content); setMessage('Publicação copiada.'); } catch { setMessage('Não foi possível copiar a publicação.'); } }}><Send size={17}/></button></div>
          {commentPost === post.id && <div className="comments"><h3>Conversa</h3>{postComments.map(item => <div key={item.id} className="comment-row"><strong>{item.author_name}</strong><p>{item.content}</p></div>)}{!socialReady ? <p className="muted">Os comentários precisam da atualização do banco.</p> : <form onSubmit={e => { e.preventDefault(); void interact(post, 'comment'); }}><label className="sr-only" htmlFor={`comment-${post.id}`}>Sua resposta</label><input id={`comment-${post.id}`} placeholder="Escreva uma resposta" value={comment} onChange={e => setComment(e.target.value)} maxLength={500} required/><button className="pill solid" disabled={Boolean(action) || !comment.trim()}>Responder</button></form>}</div>}
        </div></article>;
      })}
    </main>

    <dialog ref={dialog} className="signup-dialog media-dialog" aria-labelledby="media-title"><button className="close-dialog" aria-label="Fechar mídia" onClick={() => dialog.current?.close()}>×</button><h2 id="media-title">Compartilhe uma história.</h2><p className="muted">Cole um link HTTPS de imagem, vídeo, YouTube ou Vimeo.</p><form onSubmit={e => { e.preventDefault(); if (!mediaFromUrl(mediaDraft)) { setMediaError('Use uma imagem .jpg, .png, .gif, .webp ou .avif, vídeo .mp4, .webm ou .ogg, ou link do YouTube/Vimeo.'); return; } setMediaUrl(mediaDraft.trim()); dialog.current?.close(); }}><label htmlFor="media-url">Link da mídia</label><input id="media-url" type="url" value={mediaDraft} onChange={e => setMediaDraft(e.target.value)} placeholder="https://…" required/>{mediaError && <p className="form-message" role="status">{mediaError}</p>}<button className="pill solid">Adicionar à publicação</button></form></dialog>
  </>;
}
