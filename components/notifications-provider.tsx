'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {supabase} from '../lib/supabase';
import {notificationCount,notificationError,readNotifications} from '../lib/notifications';
import {useMusic} from './music-provider';
type Value={unread:number;revision:number;error:string;live:boolean;refresh:()=>void;markRead:(ids:string[]|null)=>Promise<void>};
const Context=createContext<Value|null>(null);
export function useNotifications(){const value=useContext(Context);if(!value)throw new Error('NotificationsProvider ausente');return value;}
export function NotificationBadge({count}:{count:number}){return count>0?<span className="notification-badge" aria-hidden="true">{count>99?'99+':count}</span>:null;}
export default function NotificationsProvider({children}:{children:ReactNode}){
 const {user}=useMusic(),userId=user?.id||null,[state,setState]=useState<{owner:string|null;unread:number;error:string;live:boolean}>({owner:null,unread:0,error:'',live:false}),[revision,setRevision]=useState(0),[retry,setRetry]=useState(0),request=useRef(0),identity=useRef(userId);identity.current=userId;
 const refresh=useCallback(()=>{setRetry(value=>value+1);setRevision(value=>value+1);},[]);
 const markRead=useCallback(async(ids:string[]|null)=>{if(!supabase||!userId)return;const owner=userId;await readNotifications(supabase,owner,ids);if(identity.current===owner)setRetry(value=>value+1);},[userId,refresh]);
 useEffect(()=>{const client=supabase;if(!client||!userId){setState({owner:null,unread:0,error:'',live:false});return;}let active=true,timer:ReturnType<typeof setTimeout>|undefined;setState({owner:userId,unread:0,error:'',live:false});
  async function load(){const version=++request.current;try{const unread=await notificationCount(client!,userId!);if(active&&identity.current===userId&&version===request.current)setState(previous=>({...previous,owner:userId,unread,error:''}));}catch(error){if(active&&version===request.current)setState(previous=>({...previous,error:notificationError(error)}));}}
  const changed=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(active){void load();setRevision(value=>value+1);}},150);};
  const channel=client.channel('notifications-realtime').on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${userId}`},changed).subscribe(status=>{if(!active)return;setState(previous=>({...previous,live:status==='SUBSCRIBED'}));if(status==='SUBSCRIBED')changed();});
  const visible=()=>{if(document.visibilityState==='visible')changed();};window.addEventListener('online',changed);window.addEventListener('focus',changed);document.addEventListener('visibilitychange',visible);void load();
  return()=>{active=false;request.current++;clearTimeout(timer);window.removeEventListener('online',changed);window.removeEventListener('focus',changed);document.removeEventListener('visibilitychange',visible);void client.removeChannel(channel);};
 },[userId]);
 useEffect(()=>{if(!supabase||!userId||!retry)return;let active=true;const version=++request.current;void notificationCount(supabase,userId).then(unread=>{if(active&&identity.current===userId&&version===request.current)setState(previous=>({...previous,owner:userId,unread,error:''}));}).catch(error=>{if(active&&version===request.current)setState(previous=>({...previous,error:notificationError(error)}));});return()=>{active=false;};},[retry,userId]);
 const current=state.owner===userId?state:{unread:0,error:'',live:false};return <Context.Provider value={{unread:current.unread,error:current.error,live:current.live,revision,refresh,markRead}}>{children}</Context.Provider>;
}
