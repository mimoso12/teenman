export type GameSource='rawg'|'steam'|'cheapshark';
export type GameOffer={storeName:string;priceFormatted:string;currency:'BRL'|'USD';discountPercent:number;url:string;free:boolean};
export type GameItem={id:string;name:string;image:string|null;source:GameSource;metacritic:number|null;released:string;platforms:string[];priceFormatted?:string;discountPercent?:number;storeName?:string;offerUrl?:string;steamId?:string;sections?:string[]};
export type GameDetails={game:GameItem;description:string;developers:string[];publishers:string[];steam:GameOffer|null;offers:GameOffer[];unavailable:string[];sourceUrl:string};
export const gamePlatforms={all:'',playstation:'187,18',xbox:'186,1',switch:'7',pc:'4'} as const;
export type GamePlatform=keyof typeof gamePlatforms;
export function resolveGamePlatform(value:string):GamePlatform|null{
 const key=value.trim().toLowerCase();const aliases:Record<string,GamePlatform>={'':'all',all:'all',todos:'all',playstation:'playstation',ps:'playstation','187,18':'playstation','18,187':'playstation',xbox:'xbox','186,1':'xbox','1,186':'xbox',switch:'switch',nintendo:'switch','7':'switch',pc:'pc','4':'pc'};return aliases[key]??null;
}
export const gameFilters=[{id:'trending',name:'Todos os Jogos'},{id:'playstation',name:'🔵 PlayStation (PS4/PS5)'},{id:'xbox',name:'🟢 Xbox'},{id:'switch',name:'🔴 Nintendo Switch'},{id:'pc',name:'PC'},{id:'steam',name:'🔥 Promoções Steam (R$)'},{id:'deals',name:'🎁 Grátis & Multi-Lojas'}] as const;
export const gameGenreFilters=[{id:'',name:'Todos os gêneros'},{id:'action',name:'Ação'},{id:'role-playing-games-rpg',name:'RPG'},{id:'adventure',name:'Aventura'},{id:'indie',name:'Indie'}] as const;
export const gameItemKey=(game:GameItem)=>`${game.source}:${game.id}:${game.offerUrl||''}`;
export function mergeGameItems(previous:GameItem[],next:GameItem[]){return [...new Map([...previous,...next].map(game=>[gameItemKey(game),game])).values()];}
export function consoleStoreLinks(game:GameItem){const term=encodeURIComponent(game.name);const links:{label:string;url:string;platform:'playstation'|'xbox'|'nintendo'}[]=[];
 if(game.platforms.some(p=>/^PS|PlayStation/i.test(p)))links.push({label:'Ver na PS Store Brasil',url:`https://store.playstation.com/pt-br/search/${term}`,platform:'playstation'});
 if(game.platforms.some(p=>/Xbox/i.test(p)))links.push({label:'Ver na Xbox Store',url:`https://www.xbox.com/pt-BR/search/results?q=${term}`,platform:'xbox'});
 if(game.platforms.some(p=>/Switch|Nintendo/i.test(p)))links.push({label:'Ver na Nintendo eShop',url:`https://www.nintendo.com/pt-br/search/#q=${term}`,platform:'nintendo'});return links;
}
export const genres=['action','role-playing-games-rpg','adventure','indie'];
export function gameImage(value:unknown){try{if(typeof value!=='string'||value.length>2048)return null;const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return null;return url.href;}catch{return null;}}
export const cleanText=(value:unknown,max=12000)=>typeof value==='string'?value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim().slice(0,max):'';
export const titleKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f™®©]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function score(value:unknown){const n=Number(value);return Number.isFinite(n)&&n>0?Math.min(100,Math.round(n)):null;}
export function amount(value:unknown):number|null{if(value===null||value===undefined||value==='')return null;const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;}
export const discount=(value:unknown)=>Math.max(0,Math.min(100,Math.round(Number(value)||0)));
export function price(value:number|null,currency:'BRL'|'USD'){return value===null?'Preço indisponível':value===0?'Gratuito':new Intl.NumberFormat('pt-BR',{style:'currency',currency,currencyDisplay:'symbol'}).format(value);}
export function dealUrl(value:string){let id=value;try{id=decodeURIComponent(value);}catch{}return `https://www.cheapshark.com/redirect?${new URLSearchParams({dealID:id})}`;}
export function platformNames(rows:any[]):string[]{return [...new Set((rows||[]).map(row=>String(row?.platform?.name||row?.name||'')).filter(Boolean).map(name=>/PlayStation 5/i.test(name)?'PS5':/PlayStation/i.test(name)?'PS':/Xbox/i.test(name)?'Xbox':/Switch/i.test(name)?'Switch':/PC|Windows/i.test(name)?'PC':name))];}
export function rawgGame(raw:any):GameItem|null{if(!raw||!Number.isSafeInteger(raw.id)||raw.id<=0||typeof raw.name!=='string')return null;return {id:String(raw.id),name:cleanText(raw.name,250),image:gameImage(raw.background_image),source:'rawg',metacritic:score(raw.metacritic),released:cleanText(raw.released,20),platforms:platformNames(raw.platforms)};}
export function steamOffer(raw:any,id:string):GameOffer|null{
 const data=raw?.price_overview||raw?.price||raw;const currency=data.currency;const cents=amount(data.final??data.final_price);
 if(raw?.is_free===true)return {storeName:'Steam Brasil',priceFormatted:'Gratuito',currency:'BRL',discountPercent:discount(data.discount_percent),url:`https://store.steampowered.com/app/${id}/`,free:true};
 if(currency!=='BRL'||cents===null)return null;
 return {storeName:'Steam Brasil',priceFormatted:price(cents/100,'BRL'),currency:'BRL',discountPercent:discount(data.discount_percent??(Number(data.initial)>0?100-cents/Number(data.initial)*100:0)),url:`https://store.steampowered.com/app/${id}/`,free:cents===0};
}
export function gamePostContent(game:GameItem,opinion:string){const head=`🎮 ${game.name.slice(0,200)}${game.platforms.length?' • '+game.platforms.join(', ').slice(0,100):''}`;const link=game.source==='steam'?`https://store.steampowered.com/app/${game.id}/`:game.source==='cheapshark'?(game.offerUrl&&game.offerUrl.length<250?game.offerUrl:'https://www.cheapshark.com/'):`https://rawg.io/games/${game.id}`;const suffix='\n'+link+(game.image&&game.image.length<350&&/\.(jpe?g|png|webp|gif|avif)$/i.test(new URL(game.image).pathname)?'\n'+game.image:'');return head+'\n\n'+(opinion.trim()||'Quem está jogando? Vamos conversar sobre esse game.').slice(0,Math.max(0,Math.min(350,1000-head.length-suffix.length-2)))+suffix;}
