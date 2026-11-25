export type House='camara'|'senado';
export type CivicPerson={id:string;casa:'Câmara'|'Senado'|'Prefeitura'|'Câmara Municipal';cargo?:'Prefeito'|'Vereador';municipio?:string;nome:string;partido:string;uf:string;fotoUrl:string|null};
export type CivicProject={id:string;titulo:string;ementa:string;ano:string;data:string;url:string};
export type CivicDetails={parlamentar:CivicPerson;nomeCompleto:string;mandato:string;situacao:string;gabinete:string;email:string;fonteUrl:string;projetos:CivicProject[];projetosIndisponiveis:boolean;fonteNome?:string;notaFonte?:string};
export const states=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const arrayOf=<T>(value:T|T[]|undefined|null):T[]=>value==null?[]:Array.isArray(value)?value:[value];
export const text=(value:unknown,max=500)=>typeof value==='string'||typeof value==='number'?String(value).trim().slice(0,max):'';
export const normalized=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function officialPhoto(value:unknown){try{const url=new URL(text(value,2048));if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port||!['camara.leg.br','senado.leg.br'].some(host=>url.hostname===host||url.hostname.endsWith('.'+host)))return null;url.protocol='https:';return url.href;}catch{return null;}}
export function chamberPerson(raw:any):CivicPerson|null{const id=text(raw?.id,12),nome=text(raw?.nome,200);if(!/^\d+$/.test(id)||!nome)return null;return {id,casa:'Câmara',nome,partido:text(raw.siglaPartido,40)||'Não informado',uf:text(raw.siglaUf,2),fotoUrl:officialPhoto(raw.urlFoto)};}
export function senatePerson(raw:any):CivicPerson|null{const row=raw?.IdentificacaoParlamentar||raw;const id=text(row?.CodigoParlamentar,12),nome=text(row?.NomeParlamentar,200);if(!/^\d+$/.test(id)||!nome)return null;return {id,casa:'Senado',nome,partido:text(row.SiglaPartidoParlamentar,40)||'Não informado',uf:text(row.UfParlamentar||raw?.Mandato?.UfParlamentar,2),fotoUrl:officialPhoto(row.UrlFotoParlamentar)};}
export const houseOf=(person:CivicPerson):House|'prefeitos'|'vereadores'=>person.casa==='Câmara'?'camara':person.casa==='Senado'?'senado':person.casa==='Prefeitura'?'prefeitos':'vereadores';
export function civicPostContent(details:CivicDetails,project?:CivicProject){
 const p=details.parlamentar;
 const heading=`🏛️ Radar Cívico • ${p.casa}\n${p.nome} (${p.partido} - ${p.uf})`;
 const body=project?`${project.titulo}\n${project.ementa}`:`${p.cargo?`Cargo: ${p.cargo}\nMunicípio: ${p.municipio} / ${p.uf}\n`:''}Mandato: ${details.mandato||'Não informado pela fonte'}${details.notaFonte?'\n'+details.notaFonte:''}`;
 const suffix=`\n\n${details.fonteNome?'Fonte: '+details.fonteNome:'Fonte oficial'}: ${project?.url||details.fonteUrl}`;
 return heading+'\n\n'+body.slice(0,Math.max(0,1000-heading.length-suffix.length-2))+suffix;
}
