import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMunicipalService,municipalPerson,municipalPhoto} from '../lib/civic-municipal';
import {civicPostContent,houseOf} from '../lib/civic';
const raw={id:10,nome_urna:'Nome de Urna',nome_civil:'Nome Civil',cargo:'PREFEITO',partido_sigla:'ABC',uf:'BA',municipio:'CRUZ DAS ALMAS',mandato:'2025-2028',situacao_eleicao:'ELEITO',ano_eleicao:2024,cpf:'excluded-document',titulo_eleitoral:'excluded-voter-id'};
test('normaliza cargo e município com avatar ausente, sem repassar documentos',()=>{
 const person=municipalPerson(raw)!;assert.equal(person.casa,'Prefeitura');assert.equal(person.cargo,'Prefeito');assert.equal(person.municipio,'CRUZ DAS ALMAS');assert.equal(person.fotoUrl,null);assert.equal(houseOf(person),'prefeitos');assert.ok(!JSON.stringify(person).includes('excluded'));
 assert.equal(municipalPerson({...raw,cargo:'VICE-PREFEITO'}),null);assert.equal(municipalPerson({...raw,cargo:'VEREADOR'})?.casa,'Câmara Municipal');assert.equal(municipalPhoto('https://tse.jus.br.evil.test/foto.jpg'),null);
});
test('envia filtros documentados e mantém paginação sem buscar a base inteira',async()=>{
 let calls=0;const service=createMunicipalService(async(input,options)=>{calls++;const url=new URL(String(input));assert.equal(url.hostname,'maquinapublica.com.br');assert.equal(url.searchParams.get('cargo'),'PREFEITO');assert.equal(url.searchParams.get('municipio'),'Cruz das Almas');assert.equal(url.searchParams.get('uf'),'BA');assert.equal(url.searchParams.get('pagina'),'2');assert.equal(new Headers(options?.headers).get('Accept'),'application/json');assert.deepEqual((options as RequestInit & {next:{revalidate:number}}).next,{revalidate:3600});return Response.json({total:130,pagina:2,por_pagina:60,resultados:[raw]});});
 const [a,b]=await Promise.all([service.list('prefeitos',{municipio:'Cruz das Almas',uf:'BA',pagina:2}),service.list('prefeitos',{municipio:'Cruz das Almas',uf:'BA',pagina:2})]);assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(a.total,130);assert.equal(a.hasMore,true);assert.equal(a.results.length,1);
});
test('detalhes e post contextualizam o resultado eleitoral sem dados pessoais extras',async()=>{
 const service=createMunicipalService(async()=>Response.json(raw));const details=await service.details('prefeitos','10');assert.equal(details.mandato,'2025-2028');assert.ok(details.notaFonte?.includes('2024'));assert.ok(!JSON.stringify(details).includes('excluded'));const post=civicPostContent(details);assert.ok(post.includes('CRUZ DAS ALMAS'));assert.ok(post.includes('Prefeito'));assert.ok(post.includes(details.fonteUrl));assert.ok(post.includes('2024'));assert.ok(post.length<=1000);await assert.rejects(service.details('vereadores','10'));
});
test('rede e JSON inválido são rejeitados para o fallback controlado da rota',async()=>{
 const offline=createMunicipalService(async()=>{throw new Error('network');});await assert.rejects(offline.list('vereadores'));
 const malformed=createMunicipalService(async()=>Response.json({total:2,resultados:null}));await assert.rejects(malformed.list('prefeitos'));
});
