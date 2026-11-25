import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import Explore from '../../../components/explore';
export default async function ExplorePage(){const client=await serverSupabase();if(!client)redirect('/');const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');return <Explore user={data.user}/>;}
