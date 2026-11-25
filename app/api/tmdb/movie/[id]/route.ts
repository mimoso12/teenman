import {movieDetails} from '../../../../../lib/tmdb-details';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const type=new URL(request.url).searchParams.get('type')||'movie';
    if(!/^\d{1,10}$/.test(id)||Number(id)<1||!['movie','tv'].includes(type))return Response.json({details:null,error:'Título inválido.'},{status:400});
    return Response.json({details:await movieDetails(Number(id),type as 'movie'|'tv')});
  }catch{return Response.json({details:null,unavailable:true,error:'Detalhes indisponíveis no momento.'},{status:200,headers:{'Cache-Control':'no-store'}});}
}
