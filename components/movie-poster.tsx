'use client';
import {useState} from 'react';
import {Clapperboard} from 'lucide-react';
export default function MoviePoster({url,title,small=false}:{url:string|null;title:string;small?:boolean}){
  const [failedUrl,setFailedUrl]=useState<string|null>(null);
  return <span className={`movie-poster${small?' mini-poster':''}`}>{url&&failedUrl!==url?<img loading="lazy" decoding="async" src={url} alt={`Pôster de ${title}`} onError={()=>setFailedUrl(url)}/>:<span className="poster-missing"><Clapperboard size={small?17:29}/>{!small&&<small>Sem pôster</small>}</span>}</span>;
}
