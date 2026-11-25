import {arrayOf,chamberPerson,senatePerson,normalized,text,type House,type CivicPerson,type CivicProject,type CivicDetails} from './civic';
const year=(value:unknown)=>/^[12]\d{3}$/.test(text(value))?text(value):'Não informado';
const CAM='https://dadosabertos.camara.leg.br/api/v2',SEN='https://legis.senado.leg.br/dadosabertos';
export function createCivicService(fetcher:typeof fetch=fetch,now=Date.now){
 const cache=new Map<string,{data:any;expires:number}>(),pending=new Map<string,Promise<any>>();
 async function get(url:string):Promise<any>{
  const hit=cache.get(url);if(hit&&hit.expires>now())return hit.data;if(pending.has(url))return pending.get(url);
  const task=(async()=>{const r=await fetcher(url,{headers:{Accept:'application/json'},next:{revalidate:3600},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Fonte indisponível');const data=await r.json();if(cache.size>=200)cache.delete(cache.keys().next().value!);cache.set(url,{data,expires:now()+3600000});return data;})();pending.set(url,task);try{return await task;}finally{pending.delete(url);}
 }
 async function senators(){const data=await get(`${SEN}/senador/lista/atual.json`);const rows=data.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar;if(!rows)throw new Error('Resposta inválida');return arrayOf<any>(rows);}
 async function deputies(nome:string,uf:string){
  const params=new URLSearchParams({itens:'100',ordem:'ASC',ordenarPor:'nome',...(nome?{nome}:{}),...(uf?{siglaUf:uf}:{})});
  const first=await get(`${CAM}/deputados?${params}`);if(!Array.isArray(first.dados))throw new Error('Resposta inválida');
  const last=arrayOf<any>(first.links).find(row=>row.rel==='last');let pages=1;try{pages=Math.min(10,Number(new URL(last?.href).searchParams.get('pagina'))||1);}catch{}
  const rest=await Promise.all(Array.from({length:pages-1},(_,i)=>get(`${CAM}/deputados?${params}&pagina=${i+2}`)));
  return [first,...rest].flatMap(data=>{if(!Array.isArray(data.dados))throw new Error('Resposta inválida');return data.dados;}).map(chamberPerson).filter((row):row is CivicPerson=>Boolean(row));
 }
 async function list(casa:'todos'|House,nome='',uf=''){
  const houses:House[]=casa==='todos'?['camara','senado']:[casa];
  const result=await Promise.allSettled(houses.map(house=>house==='camara'?deputies(nome,uf):senators().then(rows=>rows.map(senatePerson).filter((row):row is CivicPerson=>Boolean(row)))));
  const unavailable=houses.filter((_,i)=>result[i].status==='rejected');
  const items=result.flatMap(row=>row.status==='fulfilled'?row.value:[]).filter(row=>(!nome||normalized(row.nome).includes(normalized(nome)))&&(!uf||row.uf===uf));
  const unique=[...new Map(items.map(row=>[row.casa+row.id,row])).values()].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  return {results:unique,unavailable,updatedAt:new Date(now()).toISOString()};
 }
 async function details(casa:House,id:string):Promise<CivicDetails>{
  if(casa==='camara'){
   const [profile,projects]=await Promise.allSettled([get(`${CAM}/deputados/${id}`),get(`${CAM}/proposicoes?idDeputadoAutor=${id}&itens=5&ordem=DESC&ordenarPor=id`)]);
   if(profile.status!=='fulfilled')throw new Error('Fonte indisponível');const d=profile.value.dados,st=d?.ultimoStatus;const parlamentar=chamberPerson({...st,id});if(!parlamentar)throw new Error('Resposta inválida');
   const projetos=projects.status==='fulfilled'?arrayOf<any>(projects.value.dados).map(row=>({id:text(row.id),titulo:`${text(row.siglaTipo)} ${text(row.numero)}${year(row.ano)==='Não informado'?'':'/'+year(row.ano)}`,ano:year(row.ano),ementa:text(row.ementa,10000),data:text(row.dataApresentacao),url:`https://www.camara.leg.br/propostas-legislativas/${text(row.id)}`})).slice(0,5):[];
   return {parlamentar,nomeCompleto:text(d.nomeCivil),mandato:st.idLegislatura?`Legislatura ${text(st.idLegislatura)}`:'Não informado',situacao:text(st.situacao)||'Não informada',gabinete:[st.gabinete?.predio,st.gabinete?.andar,st.gabinete?.nome].filter(Boolean).map(String).join(' · '),email:text(st.email),fonteUrl:`https://www.camara.leg.br/deputados/${id}`,projetos,projetosIndisponiveis:projects.status==='rejected'};
  }
  const [profile,projects,current]=await Promise.allSettled([get(`${SEN}/senador/${id}.json`),get(`${SEN}/senador/${id}/autorias?tramitando=S`),senators()]);
  if(profile.status!=='fulfilled')throw new Error('Fonte indisponível');const d=profile.value.DetalheParlamentar?.Parlamentar;const live=current.status==='fulfilled'?current.value.find((row:any)=>String(row.IdentificacaoParlamentar?.CodigoParlamentar)===id):null;
  const parlamentar=senatePerson(live||d);if(!parlamentar)throw new Error('Resposta inválida');
  const raw=projects.status==='fulfilled'?projects.value.MateriasAutoriaParlamentar?.Parlamentar?.Autorias?.Autoria:null;
  const projetos:CivicProject[]=arrayOf<any>(raw).map(row=>row.Materia).filter(Boolean).map(row=>({id:text(row.Codigo),titulo:text(row.DescricaoIdentificacao)||`${text(row.Sigla)} ${text(row.Numero)}/${text(row.Ano)}`,ano:text(row.Ano),ementa:text(row.Ementa,10000),data:text(row.Data),url:`https://www25.senado.leg.br/web/atividade/materias/-/materia/${text(row.Codigo)}`})).sort((a,b)=>b.data.localeCompare(a.data)||Number(b.ano)-Number(a.ano)||Number(b.id)-Number(a.id)).slice(0,5);
  const mandato=live?.Mandato;
  return {parlamentar,nomeCompleto:text(d?.IdentificacaoParlamentar?.NomeCompletoParlamentar),mandato:mandato?[mandato.PrimeiraLegislaturaDoMandato?.DataInicio,mandato.SegundaLegislaturaDoMandato?.DataFim||mandato.PrimeiraLegislaturaDoMandato?.DataFim].filter(Boolean).join(' a '):'Não informado',situacao:live?'Em exercício':'Exercício atual não confirmado pela fonte',gabinete:text(d?.DadosBasicosParlamentar?.EnderecoParlamentar),email:text(d?.IdentificacaoParlamentar?.EmailParlamentar),fonteUrl:`https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`,projetos,projetosIndisponiveis:projects.status==='rejected'||(projects.status==='fulfilled'&&!projects.value.MateriasAutoriaParlamentar)};
 }
 return {list,details};
}
export const civicService=createCivicService();
