'use client';
import {useEffect,useRef} from 'react';
import type {MusicVibe} from '../lib/music-vibe';
const random=(i:number)=>{const value=Math.sin(i*127.1+311.7)*43758.5453;return value-Math.floor(value);};
export default function CinematicParticles({active,vibe}:{active:boolean;vibe:MusicVibe}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{if(!active||!canvas.current)return;const node=canvas.current,context=node.getContext('2d');if(!context)return;let frame=0,last=0,time=0,width=0,height=0;
  const theme=vibe.sceneTheme,snow=theme==='christmas-city',rain=theme==='rainy-window',ranch=theme==='country-ranch',stars=theme==='space-cosmos'||theme==='gothic-mystery'||ranch,fire=theme==='epic-fire';
  const total=snow?260:rain?170:stars?180:fire?120:70;
  const particles=Array.from({length:total},(_,i)=>({x:random(i+1),y:random(i+90),r:.5+random(i+180)*(snow?2:1.3),speed:.02+random(i+270)*(rain?.9:.055),phase:random(i+300)*Math.PI*2}));
  const resize=()=>{width=innerWidth;height=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);node.width=Math.round(width*dpr);node.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0);};resize();
  function draw(stamp:number){const delta=last?Math.min((stamp-last)/1000,.05):0;last=stamp;time+=delta;context!.clearRect(0,0,width,height);
   for(let i=0;i<particles.length;i++){const p=particles[i];
    if(stars){p.x=(p.x+delta*.0015)%1;if(ranch&&i%3===0){p.y-=delta*p.speed*.4;if(p.y<.55)p.y=1.03;}context!.globalAlpha=.18+(Math.sin(time*.7+p.phase)+1)*.25;}
    else{const up=fire||theme==='love-aurora'||theme==='tropical-sunset';p.y+=delta*p.speed*(up?-1:1);if(p.y>1.03)p.y=-.03;if(p.y<-.04)p.y=1.03;p.x=(p.x+delta*(rain?-.04:Math.sin(time*.3+p.phase)*.006)+1)%1;context!.globalAlpha=rain?.16:snow?.25+random(i+440)*.4:.24;}
    context!.fillStyle=i%3?vibe.primaryColor:vibe.secondaryColor;context!.strokeStyle=context!.fillStyle;
    const x=p.x*width,y=p.y*height;
    if(rain){context!.lineWidth=.55+p.r*.2;context!.beginPath();context!.moveTo(x,y);context!.lineTo(x-3,y+18+p.r*7);context!.stroke();}
    else{context!.beginPath();context!.arc(x,y,p.r*(fire?1.1:1),0,Math.PI*2);context!.fill();if(snow&&i%17===0){context!.lineWidth=.6;context!.beginPath();for(let arm=0;arm<3;arm++){const angle=arm*Math.PI/3,dx=Math.cos(angle)*p.r*2,dy=Math.sin(angle)*p.r*2;context!.moveTo(x-dx,y-dy);context!.lineTo(x+dx,y+dy);}context!.stroke();}if(stars&&i%19===0){context!.globalAlpha*=.45;context!.fillRect(x-3,y-.35,6,.7);context!.fillRect(x-.35,y-3,.7,6);}}
   }
   context!.globalAlpha=1;frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);window.addEventListener('resize',resize,{passive:true});return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
 },[active,vibe.sceneTheme,vibe.primaryColor,vibe.secondaryColor]);
 return <canvas ref={canvas} className="cinematic-particle-canvas"/>;
}
