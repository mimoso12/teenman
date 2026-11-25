import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPartyService,normalizeParty,partyPostContent} from '../lib/civic-parties';
const raw={id:10,sigla:'EX',nome:'Partido Exemplo',numeroEleitoral:null,status:{situacao:'Ativo',totalMembros:'0',lider:{uri:'https://dadosabertos.camara.leg.br/api/v2/deputados/123',nome:'Líder',siglaPartido:'EX',uf:'SP'}},urlLogo:'http://www.camara.leg.br/logo.gif'};
test('normaliza liderança, zero membros e número eleitoral ausente sem confundir com ID',()=>{
 const party=normalizeParty(raw)!;assert.equal(party.totalMembros,0);assert.equal(party.numeroEleitoral,null);assert.equal(party.lider?.id,'123');assert.equal(party.logoUrl,'https://www.camara.leg.br/logo.gif');assert.equal(normalizeParty({...raw,status:{}})?.totalMembros,null);
});
test('lista filtra nome/sigla, deduplica rede e usa cache diário sem consultar cada partido',async()=>{
 let calls=0,time=0;const service=createPartyService(async(input,options)=>{calls++;assert.equal(new Headers(options?.headers).get('Accept'),'application/json');assert.deepEqual((options as RequestInit & {next:{revalidate:number}}).next,{revalidate:86400});return Response.json({dados:String(input).includes('?')?[raw]:raw});},()=>time);
 const [a,b]=await Promise.all([service.list('Exemplo'),service.list('ex')]);assert.equal(a.results.length,1);assert.deepEqual(a.results,b.results);assert.equal(calls,1);time=86399999;await service.list();assert.equal(calls,1);time=86400001;await service.list();assert.equal(calls,2);
});
test('lista não requer detalhes nem inventa status',async()=>{
 const service=createPartyService(async input=>{if(!String(input).includes('?'))throw new Error('network');return Response.json({dados:[{id:10,sigla:'EX',nome:'Exemplo'}]});});
 const data=await service.list();assert.equal(data.results[0].status,'Não informado pela Câmara');assert.deepEqual(data.unavailable,[]);
});
test('bancada percorre paginação sem usar a amostra como total oficial',async()=>{
 const service=createPartyService(async input=>{const url=new URL(String(input));if(!url.pathname.endsWith('/membros'))return Response.json({dados:{...raw,status:{...raw.status,totalMembros:'70'}}});const page=Number(url.searchParams.get('pagina')||1);return Response.json({dados:[{id:page,nome:'Membro '+page,siglaPartido:'EX',siglaUf:'SP'}],links:[{rel:'last',href:'https://dadosabertos.camara.leg.br/api/v2/partidos/10/membros?pagina=2'}]});});
 const detail=await service.details('10');assert.equal(detail.membros.length,2);assert.equal(detail.partido.totalMembros,70);assert.equal(detail.membrosIndisponiveis,false);const content=partyPostContent(detail);assert.ok(content.includes('70'));assert.ok(content.includes(detail.fonteUrl));assert.ok(content.length<=1000);
});
test('falha da bancada preserva perfil e liderança oficiais',async()=>{
 const service=createPartyService(async input=>{if(String(input).includes('/membros'))throw new Error('network');return Response.json({dados:raw});});const detail=await service.details('10');assert.equal(detail.partido.sigla,'EX');assert.equal(detail.membrosIndisponiveis,true);assert.deepEqual(detail.membros,[]);
});
