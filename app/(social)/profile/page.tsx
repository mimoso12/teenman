import { redirect } from 'next/navigation';
import { serverSupabase } from '../../../lib/supabase-server';
import { fetchProfile,normalizeProfile } from '../../../lib/profile';
import ProfileScreen from '../../../components/profile-screen';
export default async function MyProfile(){
 const client=await serverSupabase();if(!client)redirect('/');
 const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');
 const result=await fetchProfile(client,data.user.id);
 const profile=result.profile||normalizeProfile({id:data.user.id,display_name:String(data.user.user_metadata?.display_name||'Membro Teenman'),created_at:data.user.created_at});
 return <ProfileScreen initialProfile={profile} viewerId={data.user.id}/>;
}
