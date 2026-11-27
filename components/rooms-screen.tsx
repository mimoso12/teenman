'use client';
import {useState} from 'react';
import type {User} from '@supabase/supabase-js';
import Rooms, {type Room} from './rooms';
export default function RoomsScreen({user}: {user: User}) {
  const [activeRoom, setActiveRoom] = useState<string | null>(null), [, setRooms] = useState<Room[]>([]);
  return <main className="social-main"><Rooms user={user} activeRoom={activeRoom} setActiveRoom={setActiveRoom} onRooms={setRooms}/></main>;
}
