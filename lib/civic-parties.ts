import {officialPhoto,text,normalized,arrayOf,chamberPerson,type CivicPerson} from './civic';
export type CivicParty={id:string;sigla:string;nome:string;numeroEleitoral:string|null;status:string;totalMembros:number|null;logoUrl:string|null;lider:CivicPerson|null;statusData:string};
export type PartyDetails={partido:CivicParty;membros:CivicPerson[];membrosIndisponiveis:boolean;fonteUrl:string};
export function normalizeParty(raw:any):CivicParty|null{
 const id=text(raw?.id,12),sigla=text(raw?.sigla,40),nome=text(raw?.nome,250);if(!/^\d+$/.test(id)||!sigla||!nome)return null;
 const status=raw.status||{},leader=status.lider;let lider:CivicPerson|null=null;
 if(leader){let leaderId='';try{leaderId=new URL(leader.uri).pathname.split('/').pop()||'';}catch{}lider=chamberPerson({...leader,id:leaderId,siglaUf:leader.uf||leader.siglaUf});}
 const total=status.totalMembros,number=total===null||total===undefined||total===''?NaN:Number(total);
 return {id,sigla,nome,numeroEleitoral:raw.numeroEleitoral==null||raw.numeroEleitoral===''?null:text(raw.numeroEleitoral,10),status:text(status.situacao,100)||'Não informado pela Câmara',totalMembros:Number.isInteger(number)&&number>=0?number:null,logoUrl:officialPhoto(raw.urlLogo),lider,statusData:text(status.data,40)};
}
export function partyPostContent(details:PartyDetails){const p=details.partido;return `🏛️ Radar Cívico • Partidos\n${p.sigla} — ${p.nome}\nSituação na Câmara: ${p.status}\nDeputados em exercício: ${p.totalMembros??'Não informado'}\nLiderança na Câmara: ${p.lider?.nome||'Não informada'}\n\nFonte oficial: ${details.fonteUrl}`.slice(0,1000);}
export function createPartyService(fetcher:typeof fetch=fetch,now=Date.now){
 const base='https://dadosabertos.camara.leg.br/api/v2',cache=new Map<string,{data:any;expires:number}>(),pending=new Map<string,Promise<any>>();
 async function get(path:string):Promise<any>{const hit=cache.get(path);if(hit&&hit.expires>now())return hit.data;if(pending.has(path))return pending.get(path);const task=(async()=>{const response=await fetcher(base+path,{headers:{Accept:'application/json'},next:{revalidate:86400},signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('Fonte indisponível');const data=await response.json();if(cache.size>=150)cache.delete(cache.keys().next().value!);cache.set(path,{data,expires:now()+86400000});return data;})();pending.set(path,task);try{return await task;}finally{pending.delete(path);}}
 function lastPage(data:any){try{const link=arrayOf<any>(data.links).find(row=>row.rel==='last');return Math.min(20,Math.max(1,Number(new URL(link.href).searchParams.get('pagina'))||1));}catch{return 1;}}
 async function list(nome=''){
  const path='/partidos?itens=100&ordem=ASC&ordenarPor=sigla',first=await get(path);if(!Array.isArray(first.dados))throw new Error('Resposta inválida');
  const rest=await Promise.all(Array.from({length:lastPage(first)-1},(_,i)=>get(path+'&pagina='+(i+2))));const raw=[first,...rest].flatMap(data=>data.dados||[]);
  const results=raw.map(normalizeParty).filter((row):row is CivicParty=>Boolean(row));
  return {results:results.filter(row=>!nome||normalized(row.sigla+' '+row.nome).includes(normalized(nome))).sort((a,b)=>a.sigla.localeCompare(b.sigla,'pt-BR')),unavailable:[] as string[],kind:'partidos' as const};
 }
 async function details(id:string):Promise<PartyDetails>{
  const [profile,members]=await Promise.allSettled([get('/partidos/'+id),get(`/partidos/${id}/membros?itens=20`)]);
  if(profile.status==='rejected')throw new Error('Fonte indisponível');const partido=normalizeParty(profile.value.dados);if(!partido)throw new Error('Partido inválido');
  let membros:CivicPerson[]=[],membrosIndisponiveis=members.status==='rejected';
  if(members.status==='fulfilled'){if(!Array.isArray(members.value.dados))membrosIndisponiveis=true;else{
   const pages=await Promise.allSettled(Array.from({length:lastPage(members.value)-1},(_,i)=>get(`/partidos/${id}/membros?itens=20&pagina=${i+2}`)));
   membrosIndisponiveis=pages.some(row=>row.status==='rejected');
   const all=[members.value,...pages.flatMap(row=>row.status==='fulfilled'?[row.value]:[])].flatMap(data=>data.dados||[]).map(chamberPerson).filter((row):row is CivicPerson=>Boolean(row));
   membros=[...new Map(all.map(row=>[row.id,row])).values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  }}
  return {partido,membros,membrosIndisponiveis,fonteUrl:base+'/partidos/'+id};
 }
 return {list,details};
}
export const partyService=createPartyService();
