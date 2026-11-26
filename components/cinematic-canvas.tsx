'use client';
import {useEffect,useRef} from 'react';
import {createCinematicCanvas} from '../lib/cinematic-canvas';
import {stageDirection,type MusicVibe} from '../lib/music-vibe';
export default function CinematicCanvas({active,vibe}:{active:boolean;vibe:MusicVibe}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const signature=JSON.stringify([stageDirection(vibe),vibe.primaryColor,vibe.secondaryColor,vibe.emojis]);
 useEffect(()=>{if(!active||!canvas.current)return;const engine=createCinematicCanvas(canvas.current,vibe);if(!engine)return;const resize=()=>engine.resize(innerWidth,innerHeight,devicePixelRatio||1);resize();engine.start();window.addEventListener('resize',resize,{passive:true});return()=>{window.removeEventListener('resize',resize);engine.stop();};},[active,signature]);
 return <canvas ref={canvas} className="cinematic-canvas" data-renderer="cinematic-canvas-v10" data-horizon={stageDirection(vibe).horizonSilhouette}/>;
}
