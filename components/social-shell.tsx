'use client';
import { useState,type FormEvent,type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname,useRouter,useSearchParams } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { BookOpen,Clapperboard,Gamepad2,Home,Landmark,LogOut,Music2,Newspaper,Radio,Search,Send,Trophy,UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useMusic } from './music-provider';
import { userHandle } from '../lib/post-media';
import { profileImage } from '../lib/profile';
import TrendingCinema from './trending-cinema';
import PostComposerProvider,{GlobalPostButton} from './post-composer';
const links=[{href:'/feed',name:'Início',icon:Home,view:'home'},{href:'/explore',name:'Explorar',icon:Search,view:'explore'},{href:'/feed?view=rooms',name:'Salas',icon:Radio,view:'rooms'},{href:'/news',name:'Notícias',icon:Newspaper,view:'news'},{href:'/feed?view=catalog',name:'Filmes',icon:Clapperboard,view:'catalog'},{href:'/music',name:'Músicas',icon:Music2,view:'music'},{href:'/games',name:'Games',icon:Gamepad2,view:'games'},{href:'/books',name:'Livros',icon:BookOpen,view:'books'},{href:'/sports',name:'Esportes',icon:Trophy,view:'sports'},{href:'/civic',name:'Radar Cívico',icon:Landmark,view:'civic'},{href:'/profile',name:'Perfil',icon:UserRound,view:'profile'}];
export default function SocialShell({children,initialUser}:{children:ReactNode;initialUser:User|null}){
  const music=useMusic(),router=useRouter(),pathname=usePathname(),params=useSearchParams();
  const user=music.user||(!music.ready?initialUser:null),profile=music.ownerProfile;
  const [query,setQuery]=useState(''),[leaving,setLeaving]=useState(false),[message,setMessage]=useState('');
  const name=profile?.display_name||String(user?.user_metadata?.display_name||'Visitante');
  const handle=profile?.username?`@${profile.username}`:user?userHandle(name,user.id):'Entre na comunidade';
  const selected=['/books','/sports','/news','/explore'].includes(pathname)?pathname.slice(1):pathname==='/games'?'games':pathname==='/civic'?'civic':pathname==='/music'?'music':pathname.startsWith('/profile')?'profile':['following','latest'].includes(params.get('view')||'')?'home':params.get('view')||'home';
  async function logout(){if(!supabase)return;setLeaving(true);setMessage('');try{const {error}=await supabase.auth.signOut();if(error)setMessage('Não foi possível sair. Tente novamente.');else{router.replace('/');}}catch{setMessage('Falha de conexão ao sair.');}finally{setLeaving(false);}}
  function search(event:FormEvent){event.preventDefault();router.push(`/explore?q=${encodeURIComponent(query.trim())}`);}
  return <PostComposerProvider user={user}><div className="social-shell">
    <aside className="social-sidebar"><Link className="social-logo" href={user?'/feed':'/'} aria-label="Teenman início"><svg viewBox="0 0 32 36" aria-hidden="true"><path d="M3 3h26l-3 7h-7v23h-6V10H6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/></svg></Link><nav aria-label="Navegação principal">{links.map(({href,name,icon:Icon,view})=><Link key={view} href={href} className={selected===view?'active':''} aria-label={name} aria-current={selected===view?'page':undefined}><Icon size={27} strokeWidth={1.8}/><span>{name}</span></Link>)}</nav><GlobalPostButton/><div className="social-account"><span className="avatar">{profileImage(profile?.avatar_url)?<img src={profileImage(profile?.avatar_url)!} alt=""/>:name.slice(0,1).toUpperCase()}</span><div><strong>{name}</strong><span>{handle}</span></div>{user?<button aria-label="Sair da conta" title="Sair" onClick={logout} disabled={leaving}><LogOut size={20}/></button>:<Link href="/" aria-label="Entrar"><LogOut size={20}/></Link>}</div>{message&&<small role="status">{message}</small>}</aside>
    {children}
    <aside className="social-discovery"><form className="discovery-search" role="search" onSubmit={search}><Search size={19}/><input aria-label="Buscar no Teenman" placeholder="Buscar no Teenman" value={query} onChange={event=>setQuery(event.target.value)}/></form><TrendingCinema/><section className="discovery-card happenings"><h2>O que está acontecendo</h2><Link className="discovery-topic" href="/feed?view=rooms"><small>Converse em tempo real</small><strong>Salas da comunidade</strong><span>Encontre sua turma</span></Link><Link className="discovery-topic" href="/feed?view=catalog"><small>Filmes & Livros</small><strong>Qual história te marcou?</strong><span>Compartilhe sua próxima descoberta</span></Link><Link className="show-more" href="/explore">Mostrar mais</Link></section><p className="discovery-footer">Respeite as pessoas e suas histórias.<br/>© {new Date().getFullYear()} Teenman</p></aside>
  <GlobalPostButton mobile/></div></PostComposerProvider>;
}
