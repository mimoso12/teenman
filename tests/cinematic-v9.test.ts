import test from 'node:test';
import assert from 'node:assert/strict';
import {createLyricsService,matchingLyrics} from '../lib/lyrics-service';
import {createMusicVibeService} from '../lib/music-vibe-service';
import {localMusicVibe,validateMusicVibe,stageDirection} from '../lib/music-vibe';
import {directionEnums,sceneCombinationCount,validateDirection} from '../lib/cinematic-schema';
const record={id:1,trackName:'Luz da Serra',artistName:'Banda Teste',plainLyrics:'Texto fictício criado para o teste. '.repeat(100)};
test('LRCLIB consulta assinatura, limita letra a 1400 caracteres e compartilha cache/solicitações',async()=>{
 let calls=0;const service=createLyricsService(async(url,options)=>{calls++;const parsed=new URL(String(url));assert.equal(parsed.pathname,'/api/get');assert.equal(parsed.searchParams.get('artist_name'),record.artistName);assert.equal(options?.signal?.aborted,false);assert.ok(new Headers(options?.headers).get('User-Agent')?.includes('Teenman'));return Response.json(record);});
 const [a,b]=await Promise.all([service.find(record.trackName,record.artistName),service.find(record.trackName,record.artistName)]);assert.equal(calls,1);assert.deepEqual(a,b);assert.equal(a.lyrics?.length,1400);assert.equal(a.status,'found');await service.find(record.trackName,record.artistName);assert.equal(calls,1);
});
test('busca alternativa não confunde músicas homônimas, instrumental e falha de rede',async()=>{
 const urls:string[]=[];const service=createLyricsService(async url=>{urls.push(String(url));return String(url).includes('/get?')?new Response('',{status:404}):Response.json([{...record,artistName:'Outro Artista'},record]);});assert.equal((await service.find(record.trackName,record.artistName)).status,'found');assert.equal(new URL(urls[1]).searchParams.get('q'),record.trackName+' '+record.artistName);
 assert.equal(matchingLyrics({...record,artistName:'Outra Banda'},record.trackName,record.artistName),null);
 assert.equal(matchingLyrics({...record,trackName:'Outra Canção'},record.trackName,record.artistName),null);
 assert.equal(matchingLyrics({...record,trackName:'夜の光',artistName:'星空楽団'},'夜の光','星空楽団')?.status,'found');
 assert.equal(matchingLyrics({...record,trackName:'別の曲',artistName:'星空楽団'},'夜の光','星空楽団'),null);
 assert.equal(matchingLyrics({...record,instrumental:true},record.trackName,record.artistName)?.status,'instrumental');
 const failed=createLyricsService(async()=>{throw new Error('offline');});assert.equal((await failed.find('A','B')).status,'unavailable');
});
test('LRCLIB honra Retry-After sem tempestade de novas consultas',async()=>{
 let calls=0,now=10000;const service=createLyricsService(async()=>{calls++;return new Response('',{status:429,headers:{'Retry-After':'60'}});},()=>now);await service.find('A','B');await service.find('C','D');assert.equal(calls,1);now+=61001;await service.find('E','F');assert.equal(calls,2);
});
test('LRCLIB encerra consulta em 2,5 segundos e não inicia fallback após timeout',async()=>{
 let calls=0;const start=Date.now();const service=createLyricsService(async(_url,options)=>{calls++;await new Promise<void>((_resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('deadline não respeitado')),3500);options?.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('timeout'));},{once:true});});return Response.json(record);});assert.equal((await service.find('A','B')).status,'unavailable');assert.equal(calls,1);assert.ok(Date.now()-start<3300);
});
test('seis camadas têm mais de 400 mil combinações e rejeitam campos arbitrários',()=>{
 assert.equal(sceneCombinationCount,4248552);const vibe=localMusicVibe('Join Us for a Bite','JT Music');assert.ok(validateMusicVibe(vibe));assert.equal(vibe.emojis.length,5);assert.equal(vibe.primaryColor,'#7c3aed');assert.equal(vibe.secondaryColor,'#f59e0b');
 for(const [key,values] of Object.entries(directionEnums)){for(const value of values)assert.ok(validateDirection({...vibe,[key]:value}),`${key} ${value}`);assert.equal(validateMusicVibe({...vibe,[key]:'<script>'}),null);}
 assert.equal(validateMusicVibe({...vibe,emojis:['🔥','✨']}),null);assert.equal(validateMusicVibe({...vibe,lyricInspo:'<img>'}),null);
});
test('universos têm prioridade correta, subgêneros distintos e cinco emojis únicos',()=>{
 const cases=[['No Mercy','The Living Tombstone','cyber-arena-hud'],['Join Us for a Bite','JT Music','fnaf-pizzeria'],["It's Been So Long",'The Living Tombstone','fnaf-pizzeria'],['Rap Naruto','7 Minutoz','anime-torii-temple'],['Hallelujah','Pentatonix','christmas-village'],['Então é Natal','Simone','christmas-village'],['Thriller','Michael Jackson','halloween-graveyard'],['Nosso Quadro','Ana Castela','sertanejo-arena'],['Evidências','Chitãozinho & Xororó','country-ranch'],['Numb','Linkin Park','metal-hellfire-stage'],['Bohemian Rhapsody','Queen','classic-rock-stage'],['Levitating','Dua Lipa','pop-neon-city'],['Ocean Eyes','Billie Eilish','pop-dream-clouds']];for(const [track,artist,horizon] of cases){const vibe=localMusicVibe(track,artist);assert.equal(vibe.horizonSilhouette,horizon,track);assert.equal(new Set(vibe.emojis).size,5);assert.ok(validateMusicVibe(vibe));}
 assert.equal(stageDirection(validateMusicVibe({vibeName:'Cena anterior',emojis:['🌙','✨'],effectType:'rain',glowColor:'#123456',secondaryColor:'#987654'})!).skyEffect,'heavy-rain');
});
test('Gemini recebe letra real limitada e devolve apenas direção, sem reenviar versos ao cliente',async()=>{
 const direction=localMusicVibe('Join Us for a Bite','JT Music');let fetched=false;
 const service=createMusicVibeService({key:()=>'test-key',lyrics:async()=>({lyrics:record.plainLyrics.slice(0,1400),status:'found',url:'https://lrclib.net/api/get/1'}),fetcher:async(_url,options)=>{fetched=true;const body=JSON.parse(String(options?.body)),input=JSON.parse(body.contents[0].parts[0].text);assert.equal(input.plainLyrics.length,1400);assert.equal(input.lyricsStatus,'found');assert.ok(body.systemInstruction.parts[0].text.includes('NÃO cite'));assert.ok(body.generationConfig.responseSchema.required.includes('emojiMotion'));return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({...direction,lyricInspo:'O tema de encontros noturnos inspira o palco e a câmera.'})}]}}]});}});
 const result=await service.generate('Join Us for a Bite','JT Music');assert.equal(fetched,true);assert.equal(result.source,'gemini');assert.match(result.lyricInspo!,/^LRCLIB/);assert.ok(!JSON.stringify(result).includes(record.plainLyrics.slice(0,100)));
});
test('sem letra não atribui versos inexistentes e Gemini inválido mantém seis camadas locais',async()=>{
 const direction=localMusicVibe('Natal','Pentatonix');const options={key:()=>'test-key',lyrics:async()=>({lyrics:null,status:'unavailable' as const,url:null})};const service=createMusicVibeService({...options,fetcher:async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify({...direction,lyricInspo:'Uma letra que não foi consultada.'})}]}}]})});const result=await service.generate('Natal','Pentatonix');assert.match(result.lyricInspo!,/não encontrada/);
 const bad=createMusicVibeService({...options,fetcher:async()=>Response.json({candidates:[{content:{parts:[{text:'not JSON'}]}}]})});assert.ok(validateDirection((await bad.generate('Natal','Pentatonix')) as Record<string,unknown>));
});
