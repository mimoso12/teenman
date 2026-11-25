import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import GamesCatalog from '../../../components/games-catalog';
export default async function GamesPage(){const client=await serverSupabase();if(!client)redirect('/');const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');return <GamesCatalog user={data.user}/>;}
