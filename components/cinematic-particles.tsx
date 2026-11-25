'use client';
import {useEffect,useRef} from 'react';
import {stageDirection,type MusicVibe} from '../lib/music-vibe';
const random=(i:number)=>{const value=Math.sin(i*127.1+311.7)*43758.5453;return value-Math.floor(value);};
export default function CinematicParticles({active,vibe}:{active:boolean;vibe:MusicVibe}){
 const canvas=useRef<HTMLCanvasElement>(null),kind=stageDirection(vibe).skyEffect;
 useEffect(()=>{if(!active||!canvas.current)return;const node=canvas.current,ctx=node.getContext('2d');if(!ctx)return;let frame=0,last=0,time=0,w=0,h=0;
 const rain=kind==='heavy-rain'||kind==='lightning-storm',snow=kind==='snowfall',up=['rising-embers','golden-dust','bubbles','musical-notes','hearts-float','arcade-sparks'].includes(kind),stars=kind==='shooting-stars',total=kind==='fog-mist'?20:kind==='sunbeams'?14:kind==='neon-lasers'?24:innerWidth<640?90:snow?220:rain?170:120;
 const particles=Array.from({length:total},(_,i)=>({x:random(i+1),y:random(i+90),r:.7+random(i+180)*2,speed:.025+random(i+270)*(rain?.75:.065),phase:random(i+300)*Math.PI*2}));
 const resize=()=>{w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);node.width=Math.round(w*dpr);node.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};resize();
 const heart=(x:number,y:number,r:number)=>{ctx.beginPath();ctx.moveTo(x,y+r);ctx.bezierCurveTo(x-r*2,y-r,x-r/2,y-r*2,x,y-r);ctx.bezierCurveTo(x+r/2,y-r*2,x+r*2,y-r,x,y+r);ctx.fill();};
 function draw(stamp:number){const delta=last?Math.min((stamp-last)/1000,.05):0;last=stamp;time+=delta;ctx!.clearRect(0,0,w,h);
 for(let i=0;i<total;i++){const a=particles[i];if(stars){a.x=(a.x+delta*.002)%1;}else{a.y+=delta*a.speed*(up?-1:1);if(a.y>1.05)a.y=-.05;if(a.y<-.05)a.y=1.05;a.x=(a.x+delta*(rain?-.035:Math.sin(time*.3+a.phase)*.008)+1)%1;}
 const x=a.x*w,y=a.y*h,r=a.r;ctx!.globalAlpha=stars?.16+(Math.sin(time*.8+a.phase)+1)*.23:rain?.2:.25;ctx!.fillStyle=i%3?vibe.primaryColor:vibe.secondaryColor;ctx!.strokeStyle=ctx!.fillStyle;ctx!.lineWidth=.7;
 if(rain){ctx!.beginPath();ctx!.moveTo(x,y);ctx!.lineTo(x-3,y+18+r*5);ctx!.stroke();}
 else if(kind==='matrix-rain'){ctx!.font='12px monospace';ctx!.globalAlpha=.18;ctx!.fillText(i%2?'1':'0',x,y);}
 else if(kind==='musical-notes'||kind==='spooky-bats'){ctx!.font=`${12+r*3}px serif`;ctx!.fillText(kind==='musical-notes'?(i%2?'♪':'♫'):'⌁',x,y);if(kind==='spooky-bats'){ctx!.beginPath();ctx!.moveTo(x-8,y-4);ctx!.quadraticCurveTo(x-4,y-12,x,y-4);ctx!.quadraticCurveTo(x+4,y-12,x+8,y-4);ctx!.stroke();}}
 else if(kind==='hearts-float')heart(x,y,r*2);
 else if(kind==='floating-petals'||kind==='autumn-leaves'){ctx!.save();ctx!.translate(x,y);ctx!.rotate(time*.25+a.phase);ctx!.beginPath();ctx!.ellipse(0,0,r*(kind==='autumn-leaves'?3:2),r,Math.PI/4,0,Math.PI*2);ctx!.fill();if(kind==='autumn-leaves'){ctx!.beginPath();ctx!.moveTo(-r*2,-r);ctx!.lineTo(r*2,r);ctx!.stroke();}ctx!.restore();}
 else if(kind==='neon-lasers'){ctx!.globalAlpha=.055;ctx!.lineWidth=1;ctx!.beginPath();ctx!.moveTo(x,h);ctx!.lineTo(x+Math.sin(time*.15+a.phase)*w*.4,0);ctx!.stroke();}
 else if(kind==='sunbeams'){ctx!.globalAlpha=.035;ctx!.lineWidth=15+r*5;ctx!.beginPath();ctx!.moveTo(w*.5,-h*.1);ctx!.lineTo(x,h);ctx!.stroke();}
 else if(kind==='fog-mist'){ctx!.globalAlpha=.018;ctx!.beginPath();ctx!.ellipse(x,h*.9+Math.sin(time*.1+a.phase)*h*.06,w*.24,h*.09,0,0,Math.PI*2);ctx!.fill();}
 else if(kind==='confetti-burst'||kind==='arcade-sparks'){ctx!.save();ctx!.translate(x,y);ctx!.rotate(time+a.phase);ctx!.fillRect(-r,-r,r*2,r*(kind==='confetti-burst'?4:2));ctx!.restore();}
 else {ctx!.beginPath();ctx!.arc(x,y,r*(snow?1:.75),0,Math.PI*2);kind==='bubbles'?ctx!.stroke():ctx!.fill();if(snow&&i%13===0){ctx!.beginPath();for(let arm=0;arm<3;arm++){const angle=arm*Math.PI/3,dx=Math.cos(angle)*r*2,dy=Math.sin(angle)*r*2;ctx!.moveTo(x-dx,y-dy);ctx!.lineTo(x+dx,y+dy);}ctx!.stroke();}if(stars&&i%17===0){ctx!.fillRect(x-3,y-.3,6,.6);ctx!.fillRect(x-.3,y-3,.6,6);}}
 }
 if(kind==='lightning-storm'&&Math.sin(time*.45)>.94){ctx!.globalAlpha=.06;ctx!.strokeStyle=vibe.secondaryColor;ctx!.lineWidth=2;ctx!.beginPath();ctx!.moveTo(w*.75,0);ctx!.lineTo(w*.68,h*.22);ctx!.lineTo(w*.74,h*.2);ctx!.lineTo(w*.65,h*.46);ctx!.stroke();}
 if(stars){const phase=time%19;if(phase<2){ctx!.globalAlpha=Math.sin(phase/2*Math.PI)*.35;ctx!.strokeStyle=vibe.secondaryColor;ctx!.beginPath();ctx!.moveTo(w*(.95-phase*.2),h*(.08+phase*.08));ctx!.lineTo(w*(.88-phase*.2),h*(.11+phase*.08));ctx!.stroke();}}
 ctx!.globalAlpha=1;frame=requestAnimationFrame(draw);}
 frame=requestAnimationFrame(draw);window.addEventListener('resize',resize,{passive:true});return()=>{cancelAnimationFrame(frame);window.removeEventListener('resize',resize);};
 },[active,kind,vibe.primaryColor,vibe.secondaryColor]);
 return <canvas ref={canvas} className="cinematic-particle-canvas" data-layer="particles" data-variant={kind}/>;
}
