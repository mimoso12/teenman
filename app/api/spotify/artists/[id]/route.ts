import {serverSupabase} from '../../../../../lib/supabase-server';
import {spotifyArtists} from '../../../../../lib/spotify-artists-server';
import {validTrackId} from '../../../../../lib/vibe';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){const headers={'Cache-Control':'private, no-store'};try{
 const client=await serverSupabase();if(!client||!(await client.auth.getUser()).data.user)return Response.json({details:null,error:'Entre para consultar artistas.'},{status:401,headers});
 const {id}=await params;if(!validTrackId(id))return Response.json({details:null,error:'Artista inválido.'},{status:400,headers});
 const name=(new URL(request.url).searchParams.get('name')||'').trim();if(name.length>200)return Response.json({details:null,error:'Nome de artista inválido.'},{status:400,headers});
 return Response.json({details:await spotifyArtists.details(id,name)},{headers});
}catch{return Response.json({details:null,error:'Perfil indisponível no momento. Tente novamente.'},{headers});}}
