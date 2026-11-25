'use client';
import { useCallback,useEffect,useState } from 'react';
import Link from 'next/link';
import { ArrowLeft,BriefcaseBusiness,CalendarDays,Disc3,Play } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile,profileImage,type ProfileData } from '../lib/profile';
import { trackFromProfile } from '../lib/vibe';
import { localMusicVibe } from '../lib/music-vibe';
import { splitPost,userHandle } from '../lib/post-media';
import PostMedia from './post-media';
import ProfileEditor from './profile-editor';
import { useMusic } from './music-provider';
type Post={id:string;author_id:string;author_name:string;content:string;created_at:string;replyTo?:string};
type Tab='posts'|'replies'|'catalog'|'likes';
const tabs:{id:Tab;label:string}[]=[{id:'posts',label:'Posts'},{id:'replies',label:'Respostas'},{id:'catalog',label:'Filmes & Livros'},{id:'likes',label:'Curtidas'}];
export default function ProfileScreen({initialProfile,viewerId}:{initialProfile:ProfileData;viewerId:string|null}){
  const music=useMusic();const [profile,setProfile]=useState(initialProfile);
  const userId=music.user?.id||viewerId,isOwner=userId===profile.id;
  const [tab,setTab]=useState<Tab>('posts'),[editing,setEditing]=useState(false);
  const [items,setItems]=useState<Post[]>([]),[loading,setLoading]=useState(true),[notice,setNotice]=useState('');
  const [postCount,setPostCount]=useState<number|null>(null),[counts,setCounts]=useState<{following:number|null;followers:number|null}>({following:null,followers:null});
  const [following,setFollowing]=useState(false),[followBusy,setFollowBusy]=useState(false);
  const track=trackFromProfile(profile);
  const vibe=profile.current_ai_vibe||(track?{...localMusicVibe(track.name,track.artist),source:'fallback' as const}:null);
  useEffect(()=>{if(music.ownerProfile?.id===profile.id)setProfile(music.ownerProfile);},[music.ownerProfile,profile.id]);
  useEffect(()=>{if(track)music.offerTrack(track);},[profile.current_spotify_track_id]);
  const loadCounts=useCallback(async()=>{
    if(!supabase)return;
    const result=await supabase.rpc('profile_follow_counts',{target_id:profile.id});
    if(!result.error&&result.data?.[0])setCounts({following:Number(result.data[0].following),followers:Number(result.data[0].followers)});
    const posts=await supabase.from('posts').select('id',{count:'exact',head:true}).eq('author_id',profile.id);
    if(!posts.error)setPostCount(posts.count||0);
    if(userId&&userId!==profile.id){const follow=await supabase.from('follows').select('following_id').eq('follower_id',userId).eq('following_id',profile.id).maybeSingle();if(!follow.error)setFollowing(Boolean(follow.data));}
  },[profile.id,userId]);
  useEffect(()=>{void loadCounts();},[loadCounts]);
  useEffect(()=>{
    if(!supabase)return;
    const client=supabase;let active=true;
    const channel=client.channel(`profile-page-${profile.id}`).on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`id=eq.${profile.id}`},()=>{void fetchProfile(client,profile.id).then(result=>{if(active&&result.profile)setProfile(result.profile);});}).subscribe();
    return()=>{active=false;void client.removeChannel(channel);};
  },[profile.id]);
  useEffect(()=>{
    let active=true;setLoading(true);setNotice('');
    async function load(){
      if(!supabase){setNotice('Não foi possível conectar ao perfil.');setLoading(false);return;}
      try{
        if((tab==='likes'||tab==='replies')&&!userId){setItems([]);setNotice('Entre no Teenman para ver esta atividade.');return;}
        if(tab==='replies'){
          const result=await supabase.from('post_comments').select('*').eq('author_id',profile.id).order('created_at',{ascending:false}).limit(50);
          if(result.error)throw result.error;
          if(active)setItems((result.data||[]).map(row=>({...row,id:`reply-${row.id}`,replyTo:row.post_id})));
        }else{
          let ids:string[]|null=null;
          if(tab==='likes'){
            const result=await supabase.from('post_likes').select('post_id').eq('user_id',profile.id).order('created_at',{ascending:false}).limit(100);if(result.error)throw result.error;ids=(result.data||[]).map(row=>row.post_id);
            if(!ids.length){if(active)setItems([]);return;}
          }
          let query=supabase.from('posts').select('*').order('created_at',{ascending:false}).limit(100);
          query=ids?query.in('id',ids):query.eq('author_id',profile.id);
          const result=await query;if(result.error)throw result.error;
          const posts=(result.data||[]) as Post[];
          if(active)setItems(tab==='catalog'?posts.filter(post=>/filme|livro|cinema|série|serie|leitura|trailer|história/i.test(post.content)||splitPost(post.content).media?.kind==='embed'):posts);
        }
      }catch{if(active){setItems([]);setNotice('Não foi possível carregar esta atividade. Tente novamente mais tarde.');}}
      finally{if(active)setLoading(false);}
    }
    void load();return()=>{active=false;};
  },[profile.id,tab,userId]);
  async function follow(){
    if(!supabase||!userId||followBusy)return;setFollowBusy(true);setNotice('');
    try{
      const result=following?await supabase.from('follows').delete().eq('follower_id',userId).eq('following_id',profile.id):await supabase.from('follows').insert({follower_id:userId,following_id:profile.id});
      if(result.error)throw result.error;setFollowing(!following);await loadCounts();
    }catch{setNotice('Não foi possível atualizar sua conexão. Tente novamente.');}finally{setFollowBusy(false);}
  }
  const avatar=profileImage(profile.avatar_url),banner=profileImage(profile.banner_url);
  return <main className="social-main profile-main">
    <header className="profile-topbar"><Link href="/feed" aria-label="Voltar ao feed"><ArrowLeft size={21}/></Link><div><h1>{profile.display_name}</h1><span>{postCount===null?'Publicações':`${postCount} ${postCount===1?'post':'posts'}`}</span></div></header>
    <section className="profile-hero"><div className="profile-banner">{banner&&<img src={banner} alt={`Capa de ${profile.display_name}`}/>}</div><div className="profile-avatar-actions"><div className="profile-big-avatar">{avatar?<img src={avatar} alt={`Foto de ${profile.display_name}`}/>:profile.display_name.slice(0,1).toUpperCase()}</div>{isOwner?<button className="pill outline" onClick={()=>setEditing(true)}>Editar perfil</button>:userId?<button className={`pill ${following?'outline':'solid'}`} disabled={followBusy} onClick={follow}>{followBusy?'Aguarde…':following?'Seguindo':'Seguir'}</button>:<Link className="pill outline" href="/">Entrar para seguir</Link>}</div><div className="profile-information"><h2>{profile.display_name}</h2><p className="profile-username">{profile.username?`@${profile.username}`:userHandle(profile.display_name,profile.id)}</p>{profile.bio&&<p className="profile-bio">{profile.bio}</p>}<div className="profile-metadata">{profile.category&&<span><BriefcaseBusiness size={16}/>{profile.category}</span>}{profile.created_at&&<span><CalendarDays size={16}/>Ingressou em {new Date(profile.created_at).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}</span>}</div><div className="profile-counts"><span><strong>{counts.following??'—'}</strong> Seguindo</span><span><strong>{counts.followers??'—'}</strong> {counts.followers===1?'Seguidor':'Seguidores'}</span></div>
      <div className="profile-music-card"><div className={`profile-mini-record${music.playing&&music.track?.id===track?.id?' spinning':''}`}>{track?.cover?<img src={track.cover} alt=""/>:<Disc3 size={25}/>}</div><div><span>OUVINDO / VIBE ATUAL</span><strong>{track?.name||'Sua próxima trilha começa aqui'}</strong>{track&&<small>{track.artist}</small>}<p>✨ IA Vibe: {vibe?vibe.vibeName:'ainda sem música'}{vibe?.source==='fallback'?' · modo local':''}</p></div>{track?<button className="pill outline" onClick={()=>music.selectTrack(track,false)}><Play size={13}/>Ouvir junto</button>:isOwner?<button className="pill outline" onClick={()=>document.querySelector<HTMLButtonElement>('.flying-vinyl-launcher')?.click()}>Escolher música</button>:null}</div>
    </div></section>
    <div className="profile-tabs" role="tablist" aria-label="Publicações do perfil">{tabs.map(item=><button key={item.id} role="tab" aria-selected={tab===item.id} onClick={()=>setTab(item.id)}>{item.label}</button>)}</div>
    {notice&&<p className="social-message" role="status">{notice}</p>}
    {loading?<p className="social-status" role="status">Carregando publicações…</p>:items.length===0&&!notice?<section className="social-empty"><h2>{isOwner?'Suas histórias começam aqui.':'Ainda sem publicações por aqui.'}</h2><p>{tab==='posts'?'As publicações aparecem nesta aba.':'A atividade deste perfil aparecerá aqui.'}</p></section>:items.map(post=>{const parsed=splitPost(post.content);return <article className="social-post" key={post.id}><Link className="avatar" href={`/profile/${post.author_id}`}>{post.author_id===profile.id&&avatar?<img src={avatar} alt=""/>:post.author_name.slice(0,1).toUpperCase()}</Link><div className="social-post-body"><div className="social-post-heading"><strong><Link href={`/profile/${post.author_id}`}>{post.author_name}</Link></strong><span className="post-date">· {new Date(post.created_at).toLocaleDateString('pt-BR',{day:'numeric',month:'short'})}</span></div>{post.replyTo&&<small className="profile-reply-label">Em resposta a uma conversa</small>}{parsed.text&&<p className="social-post-text">{parsed.text}</p>}{parsed.media&&<PostMedia media={parsed.media}/>}<Link className="profile-post-conversation" href={`/feed?view=explore&q=${encodeURIComponent(post.content.slice(0,35))}`}>Ver conversa</Link></div></article>;})}
    {isOwner&&<ProfileEditor profile={profile} open={editing} onClose={()=>setEditing(false)} onSaved={next=>{setProfile(next);void music.refreshOwner();}}/>}
  </main>;
}
