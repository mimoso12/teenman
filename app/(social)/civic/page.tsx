import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import CivicRadar from '../../../components/civic-radar';
export default async function CivicPage(){const client=await serverSupabase();if(!client)redirect('/');const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');return <CivicRadar user={data.user}/>;}
