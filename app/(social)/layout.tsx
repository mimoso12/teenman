import { Suspense } from 'react';
import { serverSupabase } from '../../lib/supabase-server';
import SocialShell from '../../components/social-shell';
export default async function SocialLayout({children}:{children:React.ReactNode}){
  const client=await serverSupabase();
  const user=client?(await client.auth.getUser()).data.user:null;
  return <Suspense fallback={<p className="social-profile-loading">Carregando Teenman…</p>}><SocialShell initialUser={user}>{children}</SocialShell></Suspense>;
}
