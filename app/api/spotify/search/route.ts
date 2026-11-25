import {serverSupabase} from '../../../../lib/supabase-server';
import {spotifyCatalog} from '../../../../lib/spotify-catalog-server';
export async function GET(request:Request){
 const headers={'Cache-Control':'private, no-store'};
 try{
  const client=await serverSupabase();if(!client||!(await client.auth.getUser()).data.user)return Response.json({tracks:[],error:'Entre para buscar músicas.'},{status:401,headers});
  const url=new URL(request.url),query=(url.searchParams.get('q')||url.searchParams.get('query')||'').trim();
  if(query.length<2||query.length>120)return Response.json({tracks:[],error:'Digite entre 2 e 120 caracteres.'},{status:400,headers});
  return Response.json({tracks:await spotifyCatalog.search(query)},{headers});
 }catch{return Response.json({tracks:[],unavailable:true,error:'A busca está indisponível. Cole um link do Spotify no Disco Voador ou tente novamente.'},{status:200,headers});}
}
