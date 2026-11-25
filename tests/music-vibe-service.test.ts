import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicVibeService } from '../lib/music-vibe-service';
import { validateMusicVibe, vibeCacheKey, effectTypes, localMusicVibe,sceneThemes,validVibeTint,vibeCssVariables } from '../lib/music-vibe';
const legacy = { vibeName: 'Órbita & Luz', emojis: ['🪐','✨','🚀','🌙'], effectType: 'stars', glowColor: '#ac92ef', secondaryColor: '#729bc5' };
const good={...legacy,sceneTheme:'space-cosmos',primaryColor:'#ac92ef',bgTint:'rgba(22,12,45,0.22)',borderColor:'#ac92ef'};
const reply = () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(good) }] } }] });
test('valida JSON e rejeita HTML, animações e cores arbitrárias', () => {
  assert.deepEqual(validateMusicVibe(good), good);
  for (const patch of [{emojis:['<script>','✨']},{glowColor:'url(javascript:x)'},{effectType:'execute'},{vibeName:'<img>'},{emojis:['abc','def']},{emojis:['✨','✨']}]) assert.equal(validateMusicVibe({...good,...patch}), null);
});
test('deduplica solicitações simultâneas e usa cache normalizado', async () => {
  let calls=0;
  const service=createMusicVibeService({key:()=> 'test-key',fetcher:async(_url,options)=>{
    calls++; assert.match(String(_url),/gemini-2\.5-flash:generateContent$/); const body=JSON.parse(String(options?.body));
    assert.equal(body.generationConfig.responseMimeType,'application/json');
    assert.ok(body.generationConfig.responseSchema.required.includes('sceneTheme'));
    assert.deepEqual(body.generationConfig.responseSchema.properties.sceneTheme.enum,[...sceneThemes]);
    assert.equal(new Headers(options?.headers).get('x-goog-api-key'),'test-key');
    return reply();
  }});
  const results=await Promise.all([service.generate('Space Song','Artista'),service.generate('Space Song','Artista')]);
  assert.equal(calls,1); assert.equal(results[0].source,'gemini');
  assert.deepEqual(await service.generate(' space song ','ARTISTA'),results[0]);
  assert.equal(calls,1);
  assert.equal(vibeCacheKey('ÁGUA','A'),vibeCacheKey('água','a'));
});
test('sem chave não consulta a rede e oferece fallback', async () => {
  const service=createMusicVibeService({key:()=>undefined,fetcher:async()=>{throw new Error('Não deveria chamar');}});
  const result=await service.generate('Noite de chuva','Artista');
  assert.equal(result.source,'fallback'); assert.equal(result.effectType,'rain');
});
test('cota bloqueada usa fallback e não repete pedidos para outras músicas durante cooldown', async () => {
  let calls=0;
  const service=createMusicVibeService({key:()=> 'test-key',fetcher:async()=>{calls++;return new Response('',{status:429});}});
  assert.equal((await service.generate('A','B')).source,'fallback');
  assert.equal((await service.generate('C','D')).source,'fallback');
  assert.equal(calls,1);
});
test('JSON inesperado e rede indisponível não interrompem a experiência', async () => {
  for(const fetcher of [async()=>Response.json({candidates:[]}),async()=>{throw new Error('offline');}]) {
    const service=createMusicVibeService({key:()=> 'test-key',fetcher});
    assert.equal((await service.generate('Música','Artista')).source,'fallback');
  }
});

test('aceita os nove efeitos com duas cores e rejeita cor secundária inválida',()=>{
 for(const effectType of effectTypes)assert.ok(validateMusicVibe({...legacy,effectType}));
 assert.equal(validateMusicVibe({...good,secondaryColor:'red'}),null);
 assert.equal(validateMusicVibe({...good,secondaryColor:undefined}),null);
 assert.notEqual(localMusicVibe('Never Gonna Give You Up','Rick Astley').effectType,'snow');
});
test('valida os nove cenários e rejeita tintas/cenas que poderiam injetar CSS ou reduzir contraste',()=>{
 for(const sceneTheme of sceneThemes)assert.ok(validateMusicVibe({...good,sceneTheme}));
 for(const patch of [{sceneTheme:'execute'},{primaryColor:'url(https://example.com)'},{borderColor:'red'},{bgTint:'rgba(256,0,0,0.22)'},{bgTint:'rgba(0,0,0,1)'},{bgTint:'rgba(0,0,0,.22);background:red'},{bgTint:'var(--x)'}])assert.equal(validateMusicVibe({...good,...patch}),null);
 assert.equal(validVibeTint('rgba(12, 34, 56, 0.22)'),true);
});
test('fallback detecta temas em português/inglês e mantém metadados antigos compatíveis',()=>{
 const cases=[['Feliz Natal','christmas-city'],['Christmas Lights','christmas-city'],['Chuva na Janela','rainy-window'],['Espaço sideral','space-cosmos'],['Fogo épico','epic-fire'],['Amor e paixão','love-aurora'],['Festa de verão','party-festival'],['Pôr do sol','tropical-sunset'],['Mistério gótico','gothic-mystery'],['Neon digital','cyberpunk-neon']];
 for(const [track,scene] of cases){const vibe=localMusicVibe(track,'Artista');assert.equal(vibe.sceneTheme,scene);assert.deepEqual(validateMusicVibe(vibe),vibe);}
 assert.equal(validateMusicVibe(legacy)?.sceneTheme,'space-cosmos');assert.equal(validateMusicVibe(legacy)?.primaryColor,legacy.glowColor);
});
test('variáveis globais usam a paleta exata da cena e retornam ao estado padrão',()=>{
 const vibe=validateMusicVibe(good)!;assert.equal(vibeCssVariables(vibe,true)['--vibe-primary'],good.primaryColor);assert.equal(vibeCssVariables(vibe,true)['--vibe-border'],good.borderColor);assert.equal(vibeCssVariables(vibe,false)['--vibe-bg-tint'],'rgba(0,0,0,0)');assert.equal(vibeCssVariables(null,true)['--vibe-strength'],'0');
});
test('modelo principal 404 usa Gemini atual automaticamente e não repete o modelo bloqueado durante cinco minutos',async()=>{
 const urls:string[]=[];const service=createMusicVibeService({key:()=>'test-key',fetcher:async(url,options)=>{urls.push(String(url));if(String(url).includes('/gemini-2.5-flash:'))return new Response('',{status:404});assert.equal(JSON.parse(String(options?.body)).generationConfig.thinkingConfig.thinkingLevel,'LOW');return reply();}});
 assert.equal((await service.generate('Natal','Artista')).source,'gemini');assert.equal((await service.generate('Espaço','Artista')).source,'gemini');assert.equal(urls.length,3);assert.ok(urls[1].includes('gemini-3.8-flash:'));assert.ok(urls[2].includes('gemini-3.8-flash:'));
});
