import type { Metadata } from 'next';
import './globals.css';
import './feed.css';
import './vibe.css';
import './flying-vinyl.css';
import './ai-stage.css';
import './profile.css';
import './catalog.css';
import './music.css';
import './civic.css';
import './games.css';
import './culture.css';
import './post-composer.css';
import './explore.css';
import MusicProvider from '../components/music-provider';
export const metadata: Metadata = { title: 'Teenman — seu espaço, sua galera', description: 'Compartilhe ideias e descubra novas conexões.' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><MusicProvider>{children}</MusicProvider></body></html>;
}
