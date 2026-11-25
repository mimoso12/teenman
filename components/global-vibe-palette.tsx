'use client';
import {useEffect} from 'react';
import {vibeCssVariables,type MusicVibe} from '../lib/music-vibe';
export default function GlobalVibePalette({active,vibe}:{active:boolean;vibe:MusicVibe|null}){
 useEffect(()=>{const root=document.documentElement,keys=Object.keys(vibeCssVariables(null,false)),previous=Object.fromEntries(keys.map(key=>[key,root.style.getPropertyValue(key)])),scene=root.dataset.vibeScene,status=root.dataset.vibeActive;
  return()=>{for(const [key,value] of Object.entries(previous)){if(value)root.style.setProperty(key,value);else root.style.removeProperty(key);}if(scene)root.dataset.vibeScene=scene;else delete root.dataset.vibeScene;if(status)root.dataset.vibeActive=status;else delete root.dataset.vibeActive;};
 },[]);
 useEffect(()=>{const root=document.documentElement;for(const [key,value] of Object.entries(vibeCssVariables(vibe,active)))root.style.setProperty(key,value);root.dataset.vibeActive=active&&vibe?'true':'false';
  if(active&&vibe){root.dataset.vibeScene=vibe.sceneTheme;return;}
  const timer=setTimeout(()=>{delete root.dataset.vibeScene;},1100);return()=>clearTimeout(timer);
 },[active,vibe?.sceneTheme,vibe?.primaryColor,vibe?.secondaryColor,vibe?.bgTint,vibe?.borderColor]);
 return null;
}
