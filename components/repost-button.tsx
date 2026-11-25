'use client';
import {Repeat2} from 'lucide-react';
export default function RepostButton({count,active,disabled,onClick}:{count:number;active:boolean;disabled:boolean;onClick:()=>void}){return <button type="button" className={active?'repost-button reposted':'repost-button'} aria-label={active?'Desfazer republicação':'Republicar'} title={active?'Desfazer republicação':'Republicar'} aria-pressed={active} disabled={disabled} onClick={onClick}><Repeat2 size={19}/><span>{count}</span></button>;}
