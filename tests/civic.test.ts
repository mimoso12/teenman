import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCivicService} from '../lib/civic-service';
import {senatePerson,officialPhoto,civicPostContent,type CivicDetails} from '../lib/civic';
const senador={IdentificacaoParlamentar:{CodigoParlamentar:'12',NomeParlamentar:'João Exemplo',UfParlamentar:'BA',SiglaPartidoParlamentar:'ABC',UrlFotoParlamentar:'http://www.senado.leg.br/senadores/img/fotos-oficiais/senador12.jpg'},Mandato:{UfParlamentar:'BA'}};
test('normaliza Senado e aceita apenas fotos oficiais em HTTPS',()=>{
 assert.equal(senatePerson(senador)?.id,'12');assert.equal(senatePerson(senador)?.casa,'Senado');assert.ok(senatePerson(senador)?.fotoUrl?.startsWith('https:'));
 assert.equal(officialPhoto('https://senado.leg.br.evil.test/image.jpg'),null);assert.equal(officialPhoto('javascript:alert(1)'),null);
});
test('filtra Senado por nome sem acento e UF, deduplica chamadas e usa cache de uma hora',async()=>{
 let calls=0;const service=createCivicService(async(_url,options)=>{calls++;assert.equal(options?.headers&&new Headers(options.headers).get('Accept'),'application/json');assert.deepEqual((options as RequestInit & {next:{revalidate:number}}).next,{revalidate:3600});return Response.json({ListaParlamentarEmExercicio:{Parlamentares:{Parlamentar:senador}}});});
 const [a,b]=await Promise.all([service.list('senado','joao','BA'),service.list('senado','João','BA')]);assert.equal(a.results.length,1);assert.deepEqual(a.results,b.results);assert.equal(calls,1);const empty=await service.list('senado','','SP');assert.equal(empty.results.length,0);assert.equal(calls,1);
});
test('falha de uma Casa mantém resultados da outra e sinaliza indisponibilidade',async()=>{
 const service=createCivicService(async url=>{if(String(url).includes('camara.leg.br'))throw new Error('network');return Response.json({ListaParlamentarEmExercicio:{Parlamentares:{Parlamentar:[senador]}}});});
 const data=await service.list('todos');assert.equal(data.results.length,1);assert.deepEqual(data.unavailable,['camara']);
});
test('lista deputados de todas as páginas e envia nome/siglaUf',async()=>{
 const pages:number[]=[];const service=createCivicService(async input=>{const url=new URL(String(input));assert.equal(url.searchParams.get('nome'),'Maria');assert.equal(url.searchParams.get('siglaUf'),'BA');const page=Number(url.searchParams.get('pagina')||1);pages.push(page);return Response.json({dados:[{id:page,nome:'Maria '+page,siglaPartido:'ABC',siglaUf:'BA'}],links:[{rel:'last',href:'https://dadosabertos.camara.leg.br/api/v2/deputados?pagina=2'}]});});
 const data=await service.list('camara','Maria','BA');assert.equal(data.results.length,2);assert.deepEqual(pages,[1,2]);
});
test('autorias do Senado são ordenadas por data e limitadas a cinco',async()=>{
 const service=createCivicService(async input=>{const url=String(input);if(url.includes('/autorias'))return Response.json({MateriasAutoriaParlamentar:{Parlamentar:{Autorias:{Autoria:Array.from({length:7},(_,i)=>({Materia:{Codigo:String(i+1),DescricaoIdentificacao:`PL ${i}/2025`,Ano:'2025',Data:`2025-01-0${i+1}`,Ementa:'Texto oficial'}}))}}}});if(url.includes('/lista/'))return Response.json({ListaParlamentarEmExercicio:{Parlamentares:{Parlamentar:[senador]}}});return Response.json({DetalheParlamentar:{Parlamentar:senador}});});
 const detail=await service.details('senado','12');assert.equal(detail.projetos.length,5);assert.equal(detail.projetos[0].id,'7');assert.equal(detail.parlamentar.uf,'BA');assert.equal(detail.projetosIndisponiveis,false);
 const content=civicPostContent(detail,{...detail.projetos[0],ementa:'x'.repeat(3000)});assert.ok(content.length<=1000);assert.ok(content.includes(detail.projetos[0].url));assert.ok(content.includes('João Exemplo'));
});
test('falha das proposições preserva o perfil oficial da Câmara',async()=>{
 const service=createCivicService(async input=>{if(String(input).includes('/proposicoes'))throw new Error('network');return Response.json({dados:{id:20,nomeCivil:'Nome Civil',ultimoStatus:{nome:'Nome Público',siglaPartido:'ABC',siglaUf:'SP',idLegislatura:57}}});});
 const detail=await service.details('camara','20');assert.equal(detail.parlamentar.nome,'Nome Público');assert.equal(detail.projetosIndisponiveis,true);assert.equal(detail.projetos.length,0);
});
