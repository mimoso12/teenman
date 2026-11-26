'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {MusicVibe} from '../lib/music-vibe';
import CinematicCanvas from './cinematic-canvas';
export default function AiStageEffects({playing,enabled,vibe}:{playing:boolean;enabled:boolean;vibe:MusicVibe|null}){
 const [visible,setVisible]=useState(false),[reduced,setReduced]=useState(false),[present,setPresent]=useState(false);
 const previous=useRef<MusicVibe|null>(null);if(vibe)previous.current=vibe;const current=vibe||previous.current;
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>{setVisible(!document.hidden);setReduced(media.matches);};update();document.addEventListener('visibilitychange',update);media.addEventListener('change',update);return()=>{document.removeEventListener('visibilitychange',update);media.removeEventListener('change',update);};},[]);
 const active=playing&&enabled&&visible&&!reduced&&Boolean(vibe);
 useEffect(()=>{if(active){setPresent(true);return;}const timer=setTimeout(()=>setPresent(false),850);return()=>clearTimeout(timer);},[active]);
 if(!present||!current)return null;
 const style={'--vibe-primary':current.primaryColor,'--vibe-secondary':current.secondaryColor} as CSSProperties;
 return createPortal(<div className="ai-stage cinematic-scene canvas-stage" data-active={active} data-scene={current.sceneTheme} style={style} aria-hidden="true"><CinematicCanvas active={active} vibe={current}/><div className="canvas-fog-plane fog-plane-one"/><div className="canvas-fog-plane fog-plane-two"/></div>,document.body);
}
