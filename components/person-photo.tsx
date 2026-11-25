'use client';
import {useState} from 'react';
import {UserRound} from 'lucide-react';
import type {PersonItem} from '../lib/tmdb';
export default function PersonPhoto({person}:{person:PersonItem}){const [failed,setFailed]=useState<string|null>(null);return <span className="person-photo">{person.photoUrl&&failed!==person.photoUrl?<img src={person.photoUrl} alt={person.name} loading="lazy" decoding="async" onError={()=>setFailed(person.photoUrl)}/>:<UserRound size={28}/>}</span>;}
