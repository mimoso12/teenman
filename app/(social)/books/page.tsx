import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import BooksCatalog from '../../../components/books-catalog';
export default async function Page(){const client=await serverSupabase();if(!client)redirect('/');const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');return <BooksCatalog user={data.user}/>;}
