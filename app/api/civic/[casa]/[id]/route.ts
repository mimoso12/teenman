import {civicService} from '../../../../../lib/civic-service';
import {municipalService} from '../../../../../lib/civic-municipal';
import type {House} from '../../../../../lib/civic';
export async function GET(_request:Request,{params}:{params:Promise<{casa:string;id:string}>}){try{
 const {casa,id}=await params;if(!['camara','senado','prefeitos','vereadores'].includes(casa)||!/^\d{1,10}$/.test(id)||Number(id)<1)return Response.json({details:null,error:'Parlamentar inválido.'},{status:400});
 const details=casa==='prefeitos'||casa==='vereadores'?await municipalService.details(casa,id):await civicService.details(casa as House,id);
 return Response.json({details});
 }catch{return Response.json({details:null,unavailable:true,error:'Não foi possível consultar os detalhes oficiais agora.'},{headers:{'Cache-Control':'no-store'}});}}
