import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import MusicCatalog from '../../../components/music-catalog';
export default async function MusicPage(){const client=await serverSupabase();if(!client)redirect('/');const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');return <MusicCatalog user={data.user}/>;}
