import {notFound} from 'next/navigation';
import {serverSupabase} from '../../../../lib/supabase-server';
import {fetchProfile,normalizeProfile} from '../../../../lib/profile';
import ProfileScreen from '../../../../components/profile-screen';
export const metadata={title:'Perfil — Teenman'};
export default async function PublicProfile({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))notFound();
 const client=await serverSupabase();if(!client)return <main className="social-main"><p className="social-profile-loading">Perfil temporariamente indisponível.</p></main>;
 const viewer=(await client.auth.getUser()).data.user;const result=await fetchProfile(client,id);
 const profile=result.profile||(viewer?.id===id?normalizeProfile({id,display_name:String(viewer.user_metadata?.display_name||'Membro Teenman'),created_at:viewer.created_at}):null);
 if(!profile){if(result.error)return <main className="social-main"><p className="social-profile-loading">Não foi possível carregar este perfil agora.</p></main>;notFound();}
 return <ProfileScreen initialProfile={profile} viewerId={viewer?.id||null}/>;
}
