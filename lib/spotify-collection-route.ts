import 'server-only';
import {serverSupabase} from './supabase-server';
import {spotifyCollections} from './spotify-collections-server';
import {validTrackId} from './vibe';
export async function collectionResponse(request:Request,params:Promise<{id:string}>,kind:'album'|'playlist'){
 const headers={'Cache-Control':'private, no-store'};try{const client=await serverSupabase();if(!client||!(await client.auth.getUser()).data.user)return Response.json({details:null,error:'Entre para consultar músicas.'},{status:401,headers});const {id}=await params;const value=new URL(request.url).searchParams.get('offset')||'0',offset=Number(value);if(!validTrackId(id)||!/^\d+$/.test(value)||!Number.isInteger(offset)||offset<0||offset>10000)return Response.json({details:null,error:'Consulta inválida.'},{status:400,headers});return Response.json({details:await spotifyCollections.details(kind,id,offset)},{headers});}catch{return Response.json({details:null,error:'O Spotify não disponibilizou as faixas desta coleção para este aplicativo.'},{headers});}
}
