import {redirect} from 'next/navigation';
import {serverSupabase} from '../../../lib/supabase-server';
import RoomsScreen from '../../../components/rooms-screen';
export default async function RoomsPage() {
  const client = await serverSupabase(), user = client && (await client.auth.getUser()).data.user;
  if (!user) redirect('/');
  return <RoomsScreen user={user}/>;
}
