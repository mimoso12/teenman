import {gamesService} from '../../../lib/games-service';
import {genres,resolveGamePlatform} from '../../../lib/games';
export async function GET(request:Request){try{
 const url=new URL(request.url),tab=url.searchParams.get('tab')||'trending',query=url.searchParams.get('query')?.trim()||'',genre=url.searchParams.get('genre')||'',pageValue=url.searchParams.get('page')||'1',page=Number(pageValue),platform=resolveGamePlatform(url.searchParams.get('platform')||'');
 if(!['trending','steam','deals'].includes(tab)||query.length>120||(genre&&!genres.includes(genre))||!/^\d+$/.test(pageValue)||!Number.isSafeInteger(page)||page<1||!platform)return Response.json({results:[],hasMore:false,error:'Filtro ou página inválida.'},{status:400});
 const data=await gamesService.list(tab,query,genre,page,platform);return Response.json({...data,page,hasMore:'hasMore' in data?data.hasMore:false},{headers:{'Cache-Control':data.unavailable.length?'no-store':'public, max-age=60, s-maxage=3600'}});
 }catch{return Response.json({results:[],hasMore:false,unavailable:['catalog'],error:'Esta fonte está indisponível. Tente novamente ou escolha outra aba.'},{headers:{'Cache-Control':'no-store'}});}}
