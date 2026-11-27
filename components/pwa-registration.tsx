'use client';
import {useEffect} from 'react';
import {useRouter} from 'next/navigation';
import {safePushUrl} from '../lib/push';
export default function PwaRegistration(){
 const router=useRouter();
 useEffect(()=>{if(!('serviceWorker' in navigator))return;const navigate=(event:MessageEvent)=>{if(event.data?.type==='TEENMAN_PUSH_NAVIGATE')router.push(safePushUrl(event.data.url));};navigator.serviceWorker.addEventListener('message',navigate);return()=>navigator.serviceWorker.removeEventListener('message',navigate);},[router]);
 useEffect(()=>{
  if(process.env.NODE_ENV!=='production'||!('serviceWorker' in navigator)||!window.isSecureContext)return;
  let cancelled=false;
  const register=()=>{if(cancelled)return;void navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(error=>console.error('[PWA] Não foi possível registrar o Service Worker.',error));};
  if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
  return()=>{cancelled=true;window.removeEventListener('load',register);};
 },[]);
 return null;
}
