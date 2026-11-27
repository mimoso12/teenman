import type { Metadata, Viewport } from 'next';
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
import './cinematic-vibe.css';
import MusicProvider from '../components/music-provider';
import PwaRegistration from '../components/pwa-registration';
export const metadata: Metadata = { title: 'Teenman — seu espaço, sua galera', description: 'Cultura pop, música viva com IA, games, cinema e debates', applicationName:'Teenman', manifest:'/manifest.json', icons:{icon:[{url:'/icon-192.png',sizes:'192x192',type:'image/png'},{url:'/icon-512.png',sizes:'512x512',type:'image/png'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}, appleWebApp:{capable:true,title:'Teenman',statusBarStyle:'black'} };
export const viewport: Viewport = {themeColor:'#000000',colorScheme:'dark',width:'device-width',initialScale:1};
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PwaRegistration/><MusicProvider>{children}</MusicProvider></body></html>;
}
