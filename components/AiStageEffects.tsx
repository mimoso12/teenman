'use client';
import { useEffect,useRef,useState,type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import type { MusicVibe } from '../lib/music-vibe';
export default function AiStageEffects({playing,enabled,vibe}:{playing:boolean;enabled:boolean;vibe:MusicVibe|null}){
  const [visible,setVisible]=useState(false),[reduced,setReduced]=useState(false);
  const canvas=useRef<HTMLCanvasElement>(null);
  const emitterRef=useRef<{node:HTMLCanvasElement;fire:ReturnType<typeof confetti.create>}|null>(null);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>{setVisible(!document.hidden);setReduced(media.matches);};update();
    document.addEventListener('visibilitychange',update);media.addEventListener('change',update);
    return()=>{document.removeEventListener('visibilitychange',update);media.removeEventListener('change',update);};
  },[]);
  const active=playing&&enabled&&visible&&!reduced&&Boolean(vibe);
  useEffect(()=>{
    if(!active||!vibe||!canvas.current||!['fireworks','confetti'].includes(vibe.effectType))return;
    if(emitterRef.current?.node!==canvas.current)emitterRef.current={node:canvas.current,fire:confetti.create(canvas.current,{resize:true,useWorker:true,disableForReducedMotion:true})};
    const emitter=emitterRef.current.fire;
    const shoot=()=>{
      const colors=[vibe.glowColor,vibe.secondaryColor];
      if(vibe.effectType==='fireworks'){
        void emitter({particleCount:20,startVelocity:23,spread:360,ticks:100,gravity:.55,scalar:.65,colors,origin:{x:.12+Math.random()*.76,y:.12+Math.random()*.35},disableForReducedMotion:true});
      }else{
        for(const x of [.05,.95])void emitter({particleCount:14,angle:x<.5?60:120,spread:55,startVelocity:22,ticks:110,gravity:.7,scalar:.65,colors,origin:{x,y:.72},disableForReducedMotion:true});
      }
    };
    shoot();const timer=setInterval(shoot,vibe.effectType==='fireworks'?3500:4500);
    return()=>{clearInterval(timer);emitter.reset();};
  },[active,vibe?.effectType,vibe?.glowColor,vibe?.secondaryColor]);
  if(!active||!vibe)return null;
  const mode=['rain','snow'].includes(vibe.effectType)?'fall':vibe.effectType==='hearts'?'rise':['siren','lightning'].includes(vibe.effectType)?'pulse':'float';
  const style={'--vibe-glow':vibe.glowColor,'--vibe-secondary':vibe.secondaryColor} as CSSProperties;
  return createPortal(<div className={`ai-stage effect-${vibe.effectType} animation-${mode}`} style={style} aria-hidden="true">
    <canvas ref={canvas} className="ai-confetti-canvas"/>
    <div className="ai-stage-emojis">{Array.from({length:16},(_,i)=><span className="vibe-emoji" key={i} style={{'--x':`${(i*37+7)%97}%`,'--y':`${(i*29+9)%85}%`,'--duration':`${12+i%7}s`,'--delay':`${-i*1.7}s`,'--drift':`${(i%2?1:-1)*(20+i*3)}px`} as CSSProperties}>{vibe.emojis[i%vibe.emojis.length]}</span>)}</div>
    {['rain','snow'].includes(vibe.effectType)&&Array.from({length:vibe.effectType==='rain'?28:22},(_,i)=><i className="ai-weather-particle" key={i} style={{'--x':`${(i*41)%101}%`,'--delay':`${-i*.71}s`,'--duration':`${vibe.effectType==='rain'?1.3+(i%5)*.15:10+(i%7)}s`,'--drift':`${i%2?35:-35}px`} as CSSProperties}/>)}
    {['neon-aurora','stars'].includes(vibe.effectType)&&<><div className="ai-aurora aurora-primary"/><div className="ai-aurora aurora-secondary"/><div className="ai-star-field"/></>}
    {['siren','lightning'].includes(vibe.effectType)&&<><div className="ai-edge-light edge-primary"/><div className="ai-edge-light edge-secondary"/></>}
    {vibe.effectType==='hearts'&&Array.from({length:18},(_,i)=><span key={i} className="ai-heart" style={{'--x':`${(i*31+3)%100}%`,'--delay':`${-i*1.9}s`,'--duration':`${15+i%6}s`,'--drift':`${i%2?20:-20}px`} as CSSProperties}>♡</span>)}
  </div>,document.body);
}
