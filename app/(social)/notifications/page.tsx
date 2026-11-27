import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import NotificationsScreen from '../../../components/notifications-screen';
export default async function NotificationsPage(){const client=await serverSupabase();if(!client)redirect('/');const {data,error}=await client.auth.getUser();if(error||!data.user)redirect('/');return <NotificationsScreen userId={data.user.id}/>;}
