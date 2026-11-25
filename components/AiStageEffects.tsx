'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import confetti from 'canvas-confetti';
import {stageDirection,type MusicVibe} from '../lib/music-vibe';
import CinematicHorizon from './cinematic-horizon';
import {SkyCenterpiece,SkyFlyer,LightingLayer} from './cinematic-sky-layers';
import CinematicParticles from './cinematic-particles';
export default function AiStageEffects({playing,enabled,vibe}:{playing:boolean;enabled:boolean;vibe:MusicVibe|null}){
 const [visible,setVisible]=useState(false),[reduced,setReduced]=useState(false),[present,setPresent]=useState(false);
 const previous=useRef<MusicVibe|null>(null),canvas=useRef<HTMLCanvasElement>(null),emitterRef=useRef<{node:HTMLCanvasElement;fire:ReturnType<typeof confetti.create>}|null>(null);
 if(vibe)previous.current=vibe;const current=vibe||previous.current;
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>{setVisible(!document.hidden);setReduced(media.matches);};update();document.addEventListener('visibilitychange',update);media.addEventListener('change',update);return()=>{document.removeEventListener('visibilitychange',update);media.removeEventListener('change',update);};},[]);
 const direction=vibe?stageDirection(vibe):null;
 const celebration=direction?.skyEffect==='fireworks'||direction?.skyEffect==='confetti-burst'||direction?.skyFlyer==='golden-fireworks-sky';
 const active=playing&&enabled&&visible&&!reduced&&Boolean(vibe);
 useEffect(()=>{if(active){setPresent(true);return;}const timer=setTimeout(()=>setPresent(false),850);return()=>clearTimeout(timer);},[active]);
 useEffect(()=>{
  if(!active||!present||!current||!celebration||!canvas.current)return;
  if(emitterRef.current?.node!==canvas.current)emitterRef.current={node:canvas.current,fire:confetti.create(canvas.current,{resize:true,useWorker:true,disableForReducedMotion:true})};
  const emitter=emitterRef.current.fire;
  const shoot=()=>{for(const x of [.04,.96])void emitter({particleCount:18,angle:x<.5?65:115,spread:48,startVelocity:22,ticks:130,gravity:.5,scalar:.6,colors:[current.primaryColor,current.secondaryColor],origin:{x,y:.94},disableForReducedMotion:true});};shoot();const timer=setInterval(shoot,5200);return()=>{clearInterval(timer);emitter.reset();};
 },[active,present,celebration,current?.primaryColor,current?.secondaryColor]);
 if(!present||!current)return null;
 const theme=current.sceneTheme,layers=stageDirection(current);
 const style={'--vibe-glow':current.primaryColor,'--vibe-primary':current.primaryColor,'--vibe-secondary':current.secondaryColor,'--vibe-bg-tint':current.bgTint} as CSSProperties;
 return createPortal(<div className={`ai-stage cinematic-scene layered-scene scene-${theme}`} data-active={active} data-scene={theme} style={style} aria-hidden="true"><CinematicHorizon kind={layers.horizonSilhouette}/><SkyCenterpiece kind={layers.skyCenterpiece}/><SkyFlyer kind={layers.skyFlyer}/><LightingLayer kind={layers.lightingFilter}/><CinematicParticles active={active} vibe={current}/><canvas ref={canvas} className="ai-confetti-canvas"/><div className={`ai-stage-emojis motion-${layers.emojiMotion}`} data-layer="emojis" data-variant={layers.emojiMotion}>{Array.from({length:15},(_,i)=><span className="vibe-emoji" key={i} style={{'--x':`${(i*37+7)%97}%`,'--y':`${(i*29+9)%85}%`,'--duration':`${17+i%7}s`,'--delay':`${-i*1.7}s`,'--drift':`${(i%2?1:-1)*(20+i*3)}px`} as CSSProperties}>{current.emojis[i%current.emojis.length]}</span>)}</div></div>,document.body);
}
