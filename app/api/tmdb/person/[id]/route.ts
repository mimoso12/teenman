import {personDetails} from '../../../../../lib/tmdb-details';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;
    if(!/^\d{1,10}$/.test(id)||Number(id)<1)return Response.json({details:null,error:'Pessoa inválida.'},{status:400});
    return Response.json({details:await personDetails(Number(id))});
  }catch{return Response.json({details:null,unavailable:true,error:'Biografia indisponível no momento.'},{status:200,headers:{'Cache-Control':'no-store'}});}
}
