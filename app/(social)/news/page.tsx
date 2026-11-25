import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import NewsCatalog from '../../../components/news-catalog';
export default async function Page(){const client=await serverSupabase();if(!client)redirect('/');const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');return <NewsCatalog user={data.user}/>;}
