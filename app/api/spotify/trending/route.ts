import {serverSupabase} from '../../../../lib/supabase-server';
import {spotifyCatalog} from '../../../../lib/spotify-catalog-server';
import {musicCategories} from '../../../../lib/music-catalog';
export async function GET(request:Request){
  const headers={'Cache-Control':'private, no-store'};
  try{
    const client=await serverSupabase();if(!client||!(await client.auth.getUser()).data.user)return Response.json({tracks:[],error:'Entre para descobrir músicas.'},{status:401,headers});
    const category=new URL(request.url).searchParams.get('category')||'trending';
    const selection=musicCategories.find(item=>item.id===category);if(!selection)return Response.json({tracks:[],error:'Categoria inválida.'},{status:400,headers});
    return Response.json({tracks:await spotifyCatalog.search(selection.query),category,source:'spotify-search'},{headers});
  }catch{return Response.json({tracks:[],unavailable:true,error:'O Spotify está indisponível. Tente novamente ou cole um link no Disco Voador.'},{status:200,headers});}
}
