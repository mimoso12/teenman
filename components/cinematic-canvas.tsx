'use client';
import {useEffect,useRef} from 'react';
import {createCinematicCanvas} from '../lib/cinematic-canvas';
import {stageDirection,type MusicVibe} from '../lib/music-vibe';
export default function CinematicCanvas({active,vibe,motion=true}:{active:boolean;vibe:MusicVibe;motion?:boolean}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const signature=JSON.stringify([stageDirection(vibe),vibe.primaryColor,vibe.secondaryColor,vibe.emojis,vibe.visualSeed]);
 useEffect(()=>{if(!active||!canvas.current)return;canvas.current.width=window.innerWidth;canvas.current.height=window.innerHeight;const engine=createCinematicCanvas(canvas.current,vibe);if(!engine)return;const resize=()=>{engine.resize(innerWidth,innerHeight,devicePixelRatio||1);engine.drawStill();};resize();if(motion)engine.start();window.addEventListener('resize',resize,{passive:true});return()=>{window.removeEventListener('resize',resize);engine.stop();};},[active,signature,motion]);
 return <canvas ref={canvas} className="cinematic-canvas" data-renderer="cinematic-canvas-v11" data-horizon={stageDirection(vibe).horizonSilhouette}/>;
}
