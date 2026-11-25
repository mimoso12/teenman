import { NextResponse, type NextRequest } from 'next/server';
import { serverSupabase } from '../../../lib/supabase-server';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const client = await serverSupabase();
  if (code && client) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/feed', request.url));
  }
  return NextResponse.redirect(new URL('/?auth_error=confirmation', request.url));
}
