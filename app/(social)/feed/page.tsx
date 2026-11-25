import { redirect } from 'next/navigation';
import { serverSupabase } from '../../../lib/supabase-server';
import Feed from '../../../components/feed';
export default async function FeedPage() {
  const client = await serverSupabase();
  if (!client) redirect('/');
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/');
  return <Feed initialUser={data.user}/>;
}
