import {XMLParser} from 'fast-xml-parser';
import {plain,publicUrl,type NewsItem} from './culture';
import {createPublicSourceClient} from './public-source-client';
export type NewsCategory='main'|'culture'|'sports';
const sources={general:{name:'G1',url:'https://g1.globo.com/rss/g1/',domain:'globo.com'},pop:{name:'G1 • Pop & Arte',url:'https://g1.globo.com/rss/g1/pop-arte/',domain:'globo.com'},sports:{name:'ge',url:'https://ge.globo.com/rss/ge/',domain:'globo.com'},omelete:{name:'Omelete',url:'https://www.omelete.com.br/rss',domain:'omelete.com.br'}};
type FeedSource=typeof sources[keyof typeof sources];
const rows=(value:any)=>value==null?[]:Array.isArray(value)?value:[value];
const value=(node:any):string=>typeof node==='string'?node:typeof node?.['#text']==='string'?node['#text']:'';
export function parseNewsFeed(xml:string,source:FeedSource):NewsItem[]{
 if(xml.length>2000000||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<rss[\s>]/i.test(xml))throw new Error('RSS inválido');
 const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',parseTagValue:false,processEntities:true});
 const data=parser.parse(xml);if(!data.rss?.channel)throw new Error('RSS inválido');
 const items:NewsItem[]=[];for(const row of rows(data.rss.channel.item)){
  const link=publicUrl(value(row.link),true),title=plain(value(row.title),350);if(!link||!title)continue;
  const url=new URL(link);if(url.hostname!==source.domain&&!url.hostname.endsWith('.'+source.domain))continue;
  url.hash='';const description=value(row.description)||value(row['content:encoded'])||value(row['atom:subtitle']);
  const media=rows(row['media:content']).find(node=>node?.['@_url'])||rows(row['media:thumbnail']).find(node=>node?.['@_url']);
  const enclosure=rows(row.enclosure).find(node=>String(node?.['@_type']||'').startsWith('image/'));
  const img=description.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  const date=new Date(value(row.pubDate)||value(row['dc:date']));
  const canonical=url.href;items.push({id:canonical,title,summary:plain(description,220),image:publicUrl(media?.['@_url']||enclosure?.['@_url']||img,true),source:source.name,publishedAt:Number.isFinite(date.getTime())?date.toISOString():null,url:canonical});
 }
 return [...new Map(items.map(item=>[item.url,item])).values()].sort((a,b)=>(Date.parse(b.publishedAt||'')||0)-(Date.parse(a.publishedAt||'')||0)).slice(0,24);
}
export function createNewsService(fetcher:typeof fetch=fetch){
 const client=createPublicSourceClient(fetcher);
 async function feed(source:FeedSource){return parseNewsFeed(await client.get(source.url,900,'text'),source);}
 async function list(category:NewsCategory){
  if(category==='culture'){try{const results=await feed(sources.omelete);if(results.length)return {results,unavailable:[] as string[],notice:''};}catch{}
   return {results:await feed(sources.pop),unavailable:['RSS Omelete'],notice:'O RSS do Omelete está indisponível. Cultura pop fornecida pelo G1 • Pop & Arte.'};
  }
  return {results:await feed(category==='sports'?sources.sports:sources.general),unavailable:[] as string[],notice:''};
 }
 return {list};
}
export const newsService=createNewsService();
