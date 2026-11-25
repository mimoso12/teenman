import {gamePlatforms,type GamePlatform,rawgGame,gameImage,cleanText,platformNames,steamOffer,titleKey,score,discount,amount,price,dealUrl,type GameItem,type GameDetails,type GameOffer,type GameSource} from './games';
const STEAM='https://store.steampowered.com/api/',CHEAP='https://www.cheapshark.com/api/1.0/';
export function createGamesService({key,fetcher=fetch,now=Date.now}:{key:()=>string|undefined;fetcher?:typeof fetch;now?:()=>number}){
 const cache=new Map<string,{data:any;expires:number}>(),pending=new Map<string,Promise<any>>();
 async function get(url:string):Promise<any>{const hit=cache.get(url);if(hit&&hit.expires>now())return hit.data;if(pending.has(url))return pending.get(url);const task=(async()=>{const response=await fetcher(url,{headers:{Accept:'application/json',...(url.startsWith(CHEAP)?{'User-Agent':'Teenman/0.1 (Games catalog; price comparison)'}:{})},next:{revalidate:3600},signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Fonte indisponível');const data=await response.json();if(cache.size>=200)cache.delete(cache.keys().next().value!);cache.set(url,{data,expires:now()+3600000});return data;})();pending.set(url,task);try{return await task;}finally{pending.delete(url);}}
 function rawgUrl(path:string,params:Record<string,string>={}){const secret=key();if(!secret)throw new Error('RAWG indisponível');return `https://api.rawg.io/api/${path}?${new URLSearchParams({key:secret,...params})}`;}
 async function stores(){const rows=await get(CHEAP+'stores');if(!Array.isArray(rows))throw new Error('Resposta inválida');return new Map<string,string>(rows.map((row:any)=>[String(row.storeID),cleanText(row.storeName,120)]));}
 function steamCard(row:any,section:string):GameItem|null{const id=String(row.id);if(!/^\d+$/.test(id)||!row.name)return null;const offer=steamOffer(row,id);return {id,name:cleanText(row.name,250),image:gameImage(row.header_image)||`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`,source:'steam',metacritic:score(row.metascore),released:'',platforms:['PC',...(row.mac_available?['macOS']:[]),...(row.linux_available?['Linux']:[])],priceFormatted:offer?.priceFormatted||'Preço indisponível',discountPercent:offer?.discountPercent||0,sections:[section]};}
 async function list(tab:string,query:string,genre:string,page=1,platform:GamePlatform='all'){
  if(tab==='steam'){
   if(query){const data=await get(STEAM+'storesearch/?'+new URLSearchParams({term:query,l:'brazilian',cc:'BR'}));return {results:(data.items||[]).filter((r:any)=>r.type==='app').map((r:any)=>steamCard({...r,header_image:null},'Busca Steam')).filter(Boolean),unavailable:[]};}
   const data=await get(STEAM+'featuredcategories?cc=BR&l=brazilian');if(!data.specials?.items||!data.top_sellers?.items)throw new Error('Resposta inválida');
   const cards:GameItem[]=[];for(const [section,rows] of [['Promoções',data.specials.items],['Mais vendidos',data.top_sellers.items]] as [string,any[]][]){for(const row of rows){const item=steamCard(row,section);if(item){const existing=cards.find(c=>c.id===item.id);if(existing){if(!existing.sections?.includes(section))existing.sections?.push(section);}else cards.push(item);}}}return {results:cards,unavailable:[]};
  }
  if(tab==='deals'){
   const [free,deals,names]=await Promise.allSettled([get(CHEAP+'deals?'+new URLSearchParams({pageSize:'8',upperPrice:'0',onSale:'1',...(query?{title:query}:{})})),get(CHEAP+'deals?'+new URLSearchParams({pageSize:'18',sortBy:'Savings',onSale:'1',...(query?{title:query}:{})})),stores()]);
   if(free.status==='rejected'&&deals.status==='rejected')throw new Error('Fonte indisponível');const storeNames=names.status==='fulfilled'?names.value:new Map<string,string>();const unique=new Map<string,GameItem>();
   for(const row of [free,deals].flatMap(r=>r.status==='fulfilled'&&Array.isArray(r.value)?r.value:[])){
    if(!row.dealID||!row.gameID||amount(row.salePrice)===null)continue;const steamId=/^\d+$/.test(String(row.steamAppID||''))?String(row.steamAppID):undefined;
    unique.set(String(row.dealID),{id:String(row.gameID),source:'cheapshark',name:cleanText(row.title,250),image:steamId?`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamId}/header.jpg`:gameImage(row.thumb),metacritic:score(row.metacriticScore),released:'',platforms:['PC'],storeName:storeNames.get(String(row.storeID))||'Loja '+row.storeID,priceFormatted:price(amount(row.salePrice),'USD'),discountPercent:discount(row.savings),offerUrl:dealUrl(String(row.dealID)),steamId});
   }return {results:[...unique.values()],unavailable:[...(free.status==='rejected'||deals.status==='rejected'?['Parte das ofertas']:[]),...(names.status==='rejected'?['Nomes das lojas']:[])]};
  }
  const data=await get(rawgUrl('games',{page:String(page),page_size:'20',...(gamePlatforms[platform]?{platforms:gamePlatforms[platform]}:{}),...(genre?{genres:genre}:{}),...(query?{search:query,search_precise:'true'}:{ordering:'-added'})}));if(!Array.isArray(data.results))throw new Error('Resposta inválida');return {results:data.results.map(rawgGame).filter(Boolean),unavailable:[],page,hasMore:Boolean(data.next)};
 }
 async function steamData(id:string){const response=await get(STEAM+'appdetails?'+new URLSearchParams({appids:id,cc:'BR',l:'brazilian'}));const data=response[id];if(!data?.success||!data.data)throw new Error('Jogo indisponível');return data.data;}
 async function details(source:GameSource,id:string,title:string):Promise<GameDetails>{
  let game:GameItem,description='',developers:string[]=[],publishers:string[]=[],sourceUrl='',base:any;
  const unavailable:string[]=[];let selectedCheap:any=null;
  if(source==='rawg'){base=await get(rawgUrl('games/'+id));const item=rawgGame(base);if(!item)throw new Error('Jogo inválido');game=item;description=cleanText(base.description_raw||base.description);developers=(base.developers||[]).map((r:any)=>cleanText(r.name,200));publishers=(base.publishers||[]).map((r:any)=>cleanText(r.name,200));sourceUrl=`https://rawg.io/games/${id}`;}
  else if(source==='steam'){base=await steamData(id);game=steamCard({...base,id,header_image:base.header_image},'Steam Brasil')!;game.platforms=Object.entries(base.platforms||{}).filter(([,v])=>v).map(([k])=>k==='windows'?'PC':k==='mac'?'macOS':'Linux');game.metacritic=score(base.metacritic?.score);game.released=cleanText(base.release_date?.date,100);description=cleanText(base.short_description||base.detailed_description);developers=(base.developers||[]).map((r:any)=>cleanText(r,200));publishers=(base.publishers||[]).map((r:any)=>cleanText(r,200));sourceUrl=`https://store.steampowered.com/app/${id}/`;}
  else{selectedCheap=await get(CHEAP+'games?id='+id);if(!selectedCheap.info?.title)throw new Error('Jogo inválido');game={id,source:'cheapshark',name:cleanText(selectedCheap.info.title,250),image:gameImage(selectedCheap.info.thumb),platforms:['PC'],metacritic:null,released:'',steamId:selectedCheap.info.steamAppID?String(selectedCheap.info.steamAppID):undefined};sourceUrl='https://www.cheapshark.com/';if(game.steamId){try{base=await steamData(game.steamId);description=cleanText(base.short_description||base.detailed_description);developers=(base.developers||[]).map((r:any)=>cleanText(r,200));publishers=(base.publishers||[]).map((r:any)=>cleanText(r,200));game.image=gameImage(base.header_image)||game.image;game.metacritic=score(base.metacritic?.score);}catch{unavailable.push('Detalhes Steam');}}}
  // O título canônico vem da fonte, nunca do parâmetro fornecido pelo cliente.
  const name=game.name||title;
  const [steamSearch,cheapSearch,storeResult,consolePlatforms]=await Promise.allSettled([get(STEAM+'storesearch/?'+new URLSearchParams({term:name,l:'brazilian',cc:'BR'})),selectedCheap?Promise.resolve(null):get(CHEAP+'games?'+new URLSearchParams({title:name,limit:'4'})),stores(),source!=='rawg'&&key()?get(rawgUrl('games',{search:name,search_precise:'true',page_size:'5'})):Promise.resolve(null)]);
  let steam:GameOffer|null=source==='steam'||base?.steam_appid?steamOffer(base,String(base?.steam_appid||id)):null;
  if(steamSearch.status==='rejected')unavailable.push('Busca Steam');
  const match=steamSearch.status==='fulfilled'?(steamSearch.value.items||[]).find((row:any)=>row.type==='app'&&titleKey(row.name)===titleKey(name)):null;
  // Hades II não pode fornecer o preço de Hades: apenas IDs ou títulos exatos são aceitos.
  if(!steam&&match){try{steam=steamOffer(await steamData(String(match.id)),String(match.id));}catch{unavailable.push('Preço Steam');}}
  const storeNames=storeResult.status==='fulfilled'?storeResult.value:new Map<string,string>();if(storeResult.status==='rejected')unavailable.push('Nomes das lojas');
  let cheap=selectedCheap;
  if(!cheap&&cheapSearch.status==='fulfilled'&&Array.isArray(cheapSearch.value)){const candidate=cheapSearch.value.find((r:any)=>(source==='steam'&&String(r.steamAppID)===id)||titleKey(r.external||'')===titleKey(name));if(candidate){try{cheap=await get(CHEAP+'games?id='+candidate.gameID);}catch{unavailable.push('Ofertas CheapShark');}}}
  if(cheapSearch.status==='rejected')unavailable.push('CheapShark');
  const offers:GameOffer[]=(cheap?.deals||[]).filter((r:any)=>amount(r.price)!==null&&r.dealID).map((r:any)=>({storeName:storeNames.get(String(r.storeID))||'Loja '+r.storeID,priceFormatted:price(amount(r.price),'USD'),currency:'USD',discountPercent:discount(r.savings),url:dealUrl(String(r.dealID)),free:amount(r.price)===0}));
  if(consolePlatforms.status==='fulfilled'&&Array.isArray(consolePlatforms.value?.results)){const match=consolePlatforms.value.results.find((row:any)=>titleKey(row.name||'')===titleKey(name));if(match)game.platforms=[...new Set([...game.platforms,...platformNames(match.platforms||[])])];}
  return {game,description,developers,publishers,sourceUrl,steam,offers,unavailable};
 }
 return {list,details};
}
export const gamesService=createGamesService({key:()=>process.env.RAWG_API_KEY});
