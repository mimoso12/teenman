import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  const protectedRoute = request.nextUrl.pathname.startsWith('/feed') || request.nextUrl.pathname === '/profile' || request.nextUrl.pathname === '/music' || request.nextUrl.pathname === '/civic' || request.nextUrl.pathname === '/games' || ['/books','/sports','/news','/explore','/notifications','/rooms'].includes(request.nextUrl.pathname);
  if (!url || !key) return protectedRoute ? NextResponse.redirect(new URL('/', request.url)) : response;
  const client = createServerClient(url, key, { cookies: {
    getAll: () => request.cookies.getAll(),
    setAll(values, headers) {
      values.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      response.headers.set('Cache-Control', 'private, no-store');
    },
  } });
  const { data, error } = await client.auth.getUser();
  const user = error ? null : data.user;
  const destination = protectedRoute && !user ? '/' : request.nextUrl.pathname === '/' && user ? '/feed' : null;
  if (destination) {
    const redirect = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    for (const header of ['cache-control', 'expires', 'pragma']) {
      const value = response.headers.get(header);
      if (value) redirect.headers.set(header, value);
    }
    return redirect;
  }
  return response;
}
export const config = { matcher: ['/', '/feed/:path*', '/profile/:path*', '/music', '/civic', '/games', '/books', '/sports', '/news', '/explore', '/notifications', '/rooms', '/api/spotify/:path*', '/auth/callback'] };
