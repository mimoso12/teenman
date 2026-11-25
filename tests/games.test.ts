import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGamesService} from '../lib/games-service';
import {steamOffer,price,gamePostContent,rawgGame,dealUrl,resolveGamePlatform,gamePlatforms,mergeGameItems,consoleStoreLinks} from '../lib/games';
import {splitPost} from '../lib/post-media';
test('preços Steam usam centavos BRL e preço ausente não significa grátis',()=>{
 assert.equal(steamOffer({currency:'BRL',final_price:7497,discount_percent:75},'1')?.priceFormatted,price(74.97,'BRL'));
 assert.equal(steamOffer({currency:'USD',final_price:100},'1'),null);assert.equal(steamOffer({},'1'),null);assert.equal(steamOffer({is_free:true},'1')?.free,true);
});
test('Steam retorna promoções e mais vendidos sem duplicar o jogo',async()=>{
 let calls=0;const item={id:1,name:'Jogo',currency:'BRL',final_price:1000};const service=createGamesService({key:()=>undefined,fetcher:async(_url,options)=>{calls++;assert.deepEqual((options as RequestInit & {next:{revalidate:number}}).next,{revalidate:3600});return Response.json({specials:{items:[item]},top_sellers:{items:[item]}});}});
 const [a,b]=await Promise.all([service.list('steam','',''),service.list('steam','','')]);assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(a.results.length,1);assert.deepEqual(a.results[0].sections,['Promoções','Mais vendidos']);
});
test('Steam e CheapShark são independentes da chave RAWG',async()=>{
 let calls=0;const service=createGamesService({key:()=>undefined,fetcher:async()=>{calls++;return Response.json({});}});await assert.rejects(service.list('trending','',''));assert.equal(calls,0);
});
test('CheapShark identifica cliente, informa lojas e mantém USD explícito',async()=>{
 const service=createGamesService({key:()=>undefined,fetcher:async(input,options)=>{assert.ok(new Headers(options?.headers).get('User-Agent')?.includes('Teenman'));return Response.json(String(input).endsWith('stores')?[{storeID:'7',storeName:'GOG'}]:[{dealID:'test%2Bid',gameID:'5',title:'Jogo',storeID:'7',salePrice:'2.99',savings:'80'}]);}});
 const data=await service.list('deals','','');assert.equal(data.results[0].storeName,'GOG');assert.equal(data.results[0].priceFormatted,price(2.99,'USD'));assert.equal(data.results[0].offerUrl,dealUrl('test+id'));
});
test('comparador recusa preço de sequência com nome parecido',async()=>{
 const service=createGamesService({key:()=> 'private-key',fetcher:async input=>{const u=String(input);if(u.includes('api.rawg'))return Response.json({id:1,name:'Hades',platforms:[]});if(u.includes('storesearch'))return Response.json({items:[{id:2,type:'app',name:'Hades II',price:{currency:'BRL',final:1000}}]});if(u.endsWith('stores'))return Response.json([]);if(u.includes('cheapshark'))return Response.json([]);throw new Error('Não deve buscar preço de Hades II');}});
 const data=await service.details('rawg','1','Título fornecido incorreto');assert.equal(data.game.name,'Hades');assert.equal(data.steam,null);assert.deepEqual(data.offers,[]);
});
test('post do jogo preserva imagem e link sem exceder limite do feed',()=>{
 const game=rawgGame({id:1,name:'Jogo',background_image:'https://media.rawg.io/media/games/cover.jpg',platforms:[{platform:{name:'PlayStation 5'}}]})!;const content=gamePostContent(game,'a'.repeat(2000));assert.ok(content.length<=1000);assert.equal(splitPost(content).media?.url,game.image);assert.ok(content.includes('PS5'));assert.ok(content.includes('https://rawg.io/games/1'));
});
test('plataformas aceitam apenas os grupos oficiais de IDs',()=>{
 assert.equal(gamePlatforms.playstation,'187,18');assert.equal(gamePlatforms.xbox,'186,1');assert.equal(gamePlatforms.switch,'7');assert.equal(gamePlatforms.pc,'4');assert.equal(resolveGamePlatform('187,18'),'playstation');assert.equal(resolveGamePlatform('186,1'),'xbox');assert.equal(resolveGamePlatform('http://evil.test'),null);
});
test('RAWG pagina 20 jogos, combina gênero/busca/plataforma e não limita por data',async()=>{
 const calls:URL[]=[];const service=createGamesService({key:()=> 'test',fetcher:async input=>{const url=new URL(String(input));calls.push(url);return Response.json({results:[{id:Number(url.searchParams.get('page')),name:'Jogo'}],next:url.searchParams.get('page')==='1'?'https://api.rawg.io/api/games?page=2':null});}});
 const a=await service.list('trending','Hades','action',1,'playstation');const b=await service.list('trending','Hades','action',2,'playstation');assert.equal(a.hasMore,true);assert.equal(b.hasMore,false);assert.equal(calls.length,2);assert.equal(calls[1].searchParams.get('page'),'2');assert.equal(calls[0].searchParams.get('page_size'),'20');assert.equal(calls[0].searchParams.get('platforms'),'187,18');assert.equal(calls[0].searchParams.get('genres'),'action');assert.equal(calls[0].searchParams.get('search'),'Hades');assert.equal(calls[0].searchParams.has('dates'),false);
});
test('cache de páginas é separado por plataforma e página',async()=>{
 let calls=0;const service=createGamesService({key:()=> 'test',fetcher:async()=>{calls++;return Response.json({results:[],next:null});}});await service.list('trending','','',1,'pc');await service.list('trending','','',2,'pc');await service.list('trending','','',1,'xbox');await service.list('trending','','',1,'pc');assert.equal(calls,3);
});
test('merge preserva ordem e jogos antigos sem duplicar páginas ou misturar ofertas',()=>{
 const a=rawgGame({id:1,name:'A'})!,b=rawgGame({id:2,name:'B'})!,c=rawgGame({id:3,name:'C'})!;assert.deepEqual(mergeGameItems([a,b],[b,c]).map(row=>row.name),['A','B','C']);assert.equal(mergeGameItems([{...a,source:'cheapshark',offerUrl:'https://www.cheapshark.com/a'}],[{...a,source:'cheapshark',offerUrl:'https://www.cheapshark.com/b'}]).length,2);
});
test('links de console codificam título e usam somente lojas oficiais disponíveis',()=>{
 const game=rawgGame({id:1,name:'A & B / Teste',platforms:[{platform:{name:'PlayStation 5'}},{platform:{name:'Xbox Series S/X'}},{platform:{name:'Nintendo Switch'}}]})!;const links=consoleStoreLinks(game);assert.equal(links.length,3);assert.deepEqual(links.map(link=>new URL(link.url).hostname),['store.playstation.com','www.xbox.com','www.nintendo.com']);assert.ok(links[0].url.includes(encodeURIComponent(game.name)));assert.equal(consoleStoreLinks({...game,platforms:['PC']}).length,0);
});
