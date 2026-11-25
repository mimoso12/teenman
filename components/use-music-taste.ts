'use client';
import {useCallback,useEffect,useState} from 'react';
import {addTaste,parseTaste,type TasteEntry} from '../lib/music-taste';
export function useMusicTaste(userId:string|null){
 const key=userId?'teenman-music-taste-v1:'+userId:null;
 const [state,setState]=useState<{key:string|null;entries:TasteEntry[]}>({key:null,entries:[]});
 useEffect(()=>{let entries:TasteEntry[]=[];try{if(key)entries=parseTaste(JSON.parse(localStorage.getItem(key)||'[]'));}catch{}setState({key,entries});},[key]);
 const record=useCallback((kind:TasteEntry['kind'],term:string,genres:string[]=[])=>{if(!key||term.trim().length<2)return;setState(previous=>{if(previous.key!==key)return previous;const entries=addTaste(previous.entries,{kind,term:term.trim().slice(0,200),genres:genres.slice(0,10),at:Date.now()});return entries===previous.entries?previous:{key,entries};});},[key]);
 useEffect(()=>{if(key&&state.key===key){try{localStorage.setItem(key,JSON.stringify(state.entries));}catch{}}},[key,state]);
 return {history:state.key===key?state.entries:[],record};
}
