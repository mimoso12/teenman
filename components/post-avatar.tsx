'use client';
import {useState} from 'react';
export default function PostAvatar({name,url,large=false}:{name:string;url?:string|null;large?:boolean}){const [failed,setFailed]=useState<string|null>(null);return <span className={`avatar post-avatar${large?' large':''}`}>{url&&failed!==url?<img src={url} alt={`Foto de ${name}`} loading="lazy" onError={()=>setFailed(url)}/>:name.slice(0,1).toUpperCase()}</span>;}
