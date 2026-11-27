'use client';
import {useState} from 'react';
import type {Track} from '../lib/vibe';
import {useMusic} from './music-provider';
export default function AddToQueue({track}: {track: Track}) {
  const music = useMusic(), [count, setCount] = useState(0);
  return <button type="button" className="add-to-queue" aria-label={`Adicionar ${track.name} à fila`} onClick={() => {music.addToQueue(track); setCount(value => value + 1);}}>+ Fila{count > 0 && <span className="sr-only" role="status"> · adicionada {count} {count === 1 ? 'vez' : 'vezes'}</span>}</button>;
}
