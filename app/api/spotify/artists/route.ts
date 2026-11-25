import {serverSupabase} from '../../../../lib/supabase-server';
import {spotifyArtists} from '../../../../lib/spotify-artists-server';
export async function GET(request:Request){const headers={'Cache-Control':'private, no-store'};try{
 const client=await serverSupabase();if(!client||!(await client.auth.getUser()).data.user)return Response.json({artists:[],error:'Entre para buscar artistas.'},{status:401,headers});
 const query=(new URL(request.url).searchParams.get('query')||'').trim();if(query.length>120)return Response.json({artists:[],error:'Use até 120 caracteres.'},{status:400,headers});
 return Response.json({artists:await spotifyArtists.list(query)},{headers});
}catch{return Response.json({artists:[],unavailable:true,error:'Artistas indisponíveis no momento. Tente novamente.'},{headers});}}
