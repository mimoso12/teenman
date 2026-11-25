import {text,type CivicPerson,type CivicDetails} from './civic';
export type MunicipalHouse='prefeitos'|'vereadores';
export const municipalNote='Base eleitoral do TSE (2024), disponibilizada pelo Políticos BR. Trocas de partido e alterações de mandato posteriores podem não estar refletidas.';
export function municipalPhoto(value:unknown){try{const url=new URL(text(value,2048));if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.port||!['maquinapublica.com.br','tse.jus.br'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))return null;url.protocol='https:';return url.href;}catch{return null;}}
export function municipalPerson(raw:any):CivicPerson|null{
 const id=text(raw?.id,12),nome=text(raw?.nome_urna||raw?.nome_civil,200),cargo=text(raw?.cargo).toUpperCase();
 if(!/^\d+$/.test(id)||Number(id)<1||!nome||!['PREFEITO','VEREADOR'].includes(cargo))return null;
 return {id,casa:cargo==='PREFEITO'?'Prefeitura':'Câmara Municipal',cargo:cargo==='PREFEITO'?'Prefeito':'Vereador',nome,partido:text(raw.partido_sigla,40)||'Não informado',uf:text(raw.uf,2).toUpperCase(),municipio:text(raw.municipio,200),fotoUrl:municipalPhoto(raw.foto_url||raw.fotoUrl||raw.foto)};
}
export function createMunicipalService(fetcher:typeof fetch=fetch,now=Date.now){
 const base='https://maquinapublica.com.br/api',cache=new Map<string,{data:any;expires:number}>(),pending=new Map<string,Promise<any>>();
 async function get(path:string):Promise<any>{const hit=cache.get(path);if(hit&&hit.expires>now())return hit.data;if(pending.has(path))return pending.get(path);const task=(async()=>{const response=await fetcher(base+path,{headers:{Accept:'application/json'},next:{revalidate:3600},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Fonte municipal indisponível');const data=await response.json();if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(path,{data,expires:now()+3600000});return data;})();pending.set(path,task);try{return await task;}finally{pending.delete(path);}}
 async function list(casa:MunicipalHouse,{nome='',uf='',municipio='',pagina=1}:{nome?:string;uf?:string;municipio?:string;pagina?:number}={}){
  const cargo=casa==='prefeitos'?'PREFEITO':'VEREADOR';
  const params=new URLSearchParams({cargo,pagina:String(pagina),por_pagina:'60',...(nome?{nome}:{}),...(uf?{uf}:{}),...(municipio?{municipio}:{})});
  const data=await get('/politicos?'+params);if(!Array.isArray(data.resultados)||!Number.isFinite(Number(data.total)))throw new Error('Resposta municipal inválida');
  const results=data.resultados.map(municipalPerson).filter((row:CivicPerson|null):row is CivicPerson=>Boolean(row&&row.casa===(casa==='prefeitos'?'Prefeitura':'Câmara Municipal')));
  const total=Math.max(0,Number(data.total)),pageSize=Number(data.por_pagina)||60;
  return {results,total,pagina,porPagina:pageSize,hasMore:pagina*pageSize<total,unavailable:[] as string[],sourceNote:municipalNote};
 }
 async function details(casa:MunicipalHouse,id:string):Promise<CivicDetails>{
  const data=await get('/politicos/'+id),person=municipalPerson(data);if(!person||person.casa!==(casa==='prefeitos'?'Prefeitura':'Câmara Municipal'))throw new Error('Cargo não corresponde');
  // Apenas campos necessários à ficha pública; documentos e dados pessoais adicionais não são repassados.
  return {parlamentar:person,nomeCompleto:text(data.nome_civil,250),mandato:text(data.mandato,100)||'Não informado pela fonte',situacao:[text(data.situacao_eleicao,100),data.ano_eleicao?'Eleição '+text(data.ano_eleicao,4):''].filter(Boolean).join(' • ')||'Resultado eleitoral não informado',gabinete:'',email:'',fonteUrl:base+'/politicos/'+id,projetos:[],projetosIndisponiveis:false,fonteNome:'Políticos BR • TSE',notaFonte:municipalNote};
 }
 return {list,details};
}
export const municipalService=createMunicipalService();
