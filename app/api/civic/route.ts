import {civicService} from '../../../lib/civic-service';
import {states,type House,type CivicPerson} from '../../../lib/civic';
import {partyService} from '../../../lib/civic-parties';
import {municipalService,municipalNote} from '../../../lib/civic-municipal';
export async function GET(request:Request){
 let casa='todos';
 try{
  const url=new URL(request.url);casa=url.searchParams.get('casa')||'todos';
  const nome=url.searchParams.get('nome')?.trim()||'',uf=url.searchParams.get('uf')?.toUpperCase()||'',municipio=url.searchParams.get('municipio')?.trim()||'',pagina=Number(url.searchParams.get('pagina')||1);
  if(!['todos','camara','senado','partidos','prefeitos','vereadores'].includes(casa)||nome.length>120||municipio.length>120||(uf&&!states.includes(uf))||!Number.isInteger(pagina)||pagina<1||pagina>10000)return Response.json({results:[],error:'Filtro inválido.'},{status:400});
  if(casa==='partidos'){const data=await partyService.list(nome);return Response.json(data,{headers:{'Cache-Control':data.unavailable.length?'no-store':'public, max-age=60, s-maxage=86400'}});}
  if(casa==='prefeitos'||casa==='vereadores'){const data=await municipalService.list(casa,{nome,uf,municipio,pagina});return Response.json(data,{headers:{'Cache-Control':'public, max-age=60, s-maxage=3600'}});}
  if(casa==='todos'){
   const calls=await Promise.allSettled([civicService.list('todos',nome,uf),municipalService.list('prefeitos',{nome,uf,municipio,pagina}),municipalService.list('vereadores',{nome,uf,municipio,pagina})]);
   const results:CivicPerson[]=[],unavailable:string[]=[];let total=0,hasMore=false;
   calls.forEach((result,index)=>{if(result.status==='rejected'){unavailable.push(...(index===0?['camara','senado']:[index===1?'prefeitos':'vereadores']));return;}const value=result.value;results.push(...value.results);unavailable.push(...value.unavailable);total+='total' in value?value.total:value.results.length;hasMore||='hasMore' in value&&value.hasMore;});
   const data={results:results.sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR')),total,pagina,hasMore,unavailable,sourceNote:municipalNote};
   return Response.json(data,{headers:{'Cache-Control':unavailable.length?'no-store':'public, max-age=60, s-maxage=3600'}});
  }
  const data=await civicService.list(casa as House,nome,uf);return Response.json({...data,total:data.results.length,pagina,hasMore:false},{headers:{'Cache-Control':data.unavailable.length?'no-store':'public, max-age=60, s-maxage=3600'}});
 }catch{return Response.json({results:[],total:0,pagina:1,hasMore:false,unavailable:casa==='todos'?['camara','senado','prefeitos','vereadores']:[casa],error:'A fonte está indisponível no momento. Tente novamente mais tarde.'},{headers:{'Cache-Control':'no-store'}});}
}
