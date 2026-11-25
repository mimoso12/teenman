'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchProfile, normalizeProfile, type ProfileData } from '../lib/profile';
import { profileColumns, trackFromProfile, type Track } from '../lib/vibe';
import type { VibeResult } from '../lib/music-vibe';
import { useMusicVibe } from './use-music-vibe';
import VibeWidget from './vibe-widget';
import AiStageEffects from './AiStageEffects';
import GlobalVibePalette from './global-vibe-palette';
import {useMusicTaste} from './use-music-taste';
import type {TasteEntry} from '../lib/music-taste';
type MusicContextValue = {
  taste:TasteEntry[];recordTaste:(kind:TasteEntry['kind'],term:string,genres?:string[])=>void;
  user:User|null; ready:boolean; ownerProfile:ProfileData|null; track:Track|null; playing:boolean;
  setPlaying:(value:boolean)=>void; selectTrack:(track:Track,pin?:boolean)=>void; offerTrack:(track:Track)=>void;
  playTrack:(track:Track)=>void;playRequest:number;
  pinTrack:()=>void; status:'idle'|'saving'|'saved'|'error'; message:string;
  vibe:VibeResult|null; analyzing:boolean; effects:boolean; toggleEffects:()=>void; openSignal:number;
  refreshOwner:()=>Promise<void>;
};
const MusicContext=createContext<MusicContextValue|null>(null);
export function useMusic(){const context=useContext(MusicContext);if(!context)throw new Error('MusicProvider ausente');return context;}
export default function MusicProvider({children}:{children:ReactNode}){
  const pathname=usePathname();
  const [user,setUser]=useState<User|null>(null),[ready,setReady]=useState(false);
  const taste=useMusicTaste(user?.id||null);
  const [ownerProfile,setOwnerProfile]=useState<ProfileData|null>(null),[enhanced,setEnhanced]=useState(false);
  const [track,setTrack]=useState<Track|null>(null),[playing,setPlaying]=useState(false);
  const active=useRef<Track|null>(null),identity=useRef<string|null|undefined>(undefined);
  const [playRequest,setPlayRequest]=useState(0);
  const [effects,setEffects]=useState(true),[openSignal,setOpenSignal]=useState(0),[autoPin,setAutoPin]=useState(false);
  const [status,setStatus]=useState<MusicContextValue['status']>('idle'),[message,setMessage]=useState('');
  const queue=useRef(Promise.resolve()),revision=useRef(0),lastSaved=useRef('');
  const analysis=useMusicVibe(track,Boolean(track),true);
  useEffect(()=>{try{const saved=localStorage.getItem('teenman-auto-effects-v2');if(saved!==null)setEffects(saved==='on');}catch{}},[]);
  useEffect(()=>{
    if(!supabase){setReady(true);return;}
    const {data}=supabase.auth.onAuthStateChange((_event,session)=>{
      const next=session?.user||null;
      if(identity.current!==undefined&&identity.current!==next?.id&&identity.current!==null){active.current=null;setTrack(null);setPlaying(false);setPlayRequest(0);setAutoPin(false);setOwnerProfile(null);setStatus('idle');}
      identity.current=next?.id||null;setUser(next);setReady(true);
    });
    return()=>data.subscription.unsubscribe();
  },[]);
  const refreshOwner=useCallback(async()=>{
    if(!supabase||!user)return;
    const result=await fetchProfile(supabase,user.id);
    if(identity.current!==user.id)return;
    setEnhanced(result.enhanced);
    if(result.profile){setOwnerProfile(result.profile);const pinned=trackFromProfile(result.profile);if(!active.current&&pinned){active.current=pinned;setTrack(pinned);}}
  },[user?.id]);
  useEffect(()=>{
    if(!user||!supabase)return;
    void refreshOwner();
    const channel=supabase.channel(`global-music-${user.id}`).on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`id=eq.${user.id}`},()=>void refreshOwner()).subscribe();
    return()=>{void supabase!.removeChannel(channel);};
  },[user?.id,refreshOwner]);
  function persist(selected:Track,vibe:VibeResult|null){
    if(!user||!supabase)return;
    const owner=user.id,name=ownerProfile?.display_name||String(user.user_metadata?.display_name||'Membro Teenman');
    const version=++revision.current;
    setStatus('saving');setMessage('');
    queue.current=queue.current.catch(()=>{}).then(async()=>{
      try{
        const auth=await supabase!.auth.getUser();if(auth.data.user?.id!==owner)throw new Error('session');
        const payload={current_spotify_track_id:selected.id,current_track_name:selected.name,current_artist_name:selected.artist,current_album_cover:selected.cover,current_atmosphere:'normal',...(enhanced?{current_ai_vibe:vibe}:{})};
        let result=await supabase!.from('profiles').update(payload).eq('id',owner).select(profileColumns).maybeSingle();
        if(!result.error&&!result.data){
          result=await supabase!.from('profiles').insert({id:owner,display_name:name,...payload}).select(profileColumns).single();
          if(result.error?.code==='23505')result=await supabase!.from('profiles').update(payload).eq('id',owner).select(profileColumns).single();
        }
        if(result.error)throw result.error;
        if(identity.current===owner&&version===revision.current){setStatus('saved');setOwnerProfile(previous=>normalizeProfile({...previous,...result.data,current_ai_vibe:vibe} as ProfileData));}
      }catch{if(identity.current===owner&&version===revision.current){setStatus('error');setMessage('A música continua disponível, mas ainda não foi salva no perfil. Tente fixar novamente.');}}
    });
  }
  useEffect(()=>{
    if(!autoPin||!track||!analysis.vibe||!user||!enhanced)return;
    const signature=JSON.stringify([user.id,track.id,analysis.vibe]);
    if(lastSaved.current===signature)return;lastSaved.current=signature;persist(track,analysis.vibe);
  },[autoPin,track?.id,analysis.vibe,user?.id,enhanced]);
  function selectTrack(next:Track,pin=true){
    if(active.current?.id!==next.id)setPlaying(false);
    active.current=next;setTrack(next);setAutoPin(Boolean(user&&pin));setOpenSignal(value=>value+1);
    if(user&&pin){lastSaved.current='';persist(next,null);}
  }
  function playTrack(next:Track){taste.record('play',next.artist);selectTrack(next);setPlayRequest(value=>value+1);}
  function offerTrack(next:Track){if(!active.current){active.current=next;setTrack(next);}}
  function pinTrack(){if(!track)return;setAutoPin(true);if(user&&analysis.vibe)lastSaved.current=JSON.stringify([user.id,track.id,analysis.vibe]);persist(track,analysis.vibe);}
  function toggleEffects(){setEffects(previous=>{const next=!previous;try{localStorage.setItem('teenman-auto-effects-v2',next?'on':'off');}catch{}return next;});}
  const visible=ready&&(Boolean(user)||(pathname!=='/'&&Boolean(track)));
  return <MusicContext.Provider value={{taste:taste.history,recordTaste:taste.record,user,ready,ownerProfile,track,playing,setPlaying,selectTrack,playTrack,playRequest,offerTrack,pinTrack,status,message,vibe:analysis.vibe,analyzing:analysis.loading,effects,toggleEffects,openSignal,refreshOwner}}>
    {children}
    {visible&&<VibeWidget/>}
    <GlobalVibePalette active={visible&&playing&&effects} vibe={analysis.vibe}/>
    <AiStageEffects playing={visible&&playing} enabled={effects} vibe={analysis.vibe}/>
  </MusicContext.Provider>;
}
