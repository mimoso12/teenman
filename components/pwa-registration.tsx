'use client';
import {useEffect} from 'react';
export default function PwaRegistration(){
 useEffect(()=>{
  if(process.env.NODE_ENV!=='production'||!('serviceWorker' in navigator)||!window.isSecureContext)return;
  let cancelled=false;
  const register=()=>{if(cancelled)return;void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>console.error('[PWA] Não foi possível registrar o Service Worker.',error));};
  if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
  return()=>{cancelled=true;window.removeEventListener('load',register);};
 },[]);
 return null;
}
