import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicVibeService } from '../lib/music-vibe-service';
import { validateMusicVibe, vibeCacheKey, effectTypes, localMusicVibe } from '../lib/music-vibe';
const good = { vibeName: 'Órbita & Luz', emojis: ['🪐','✨','🚀','🌙'], effectType: 'stars', glowColor: '#ac92ef', secondaryColor: '#729bc5' };
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
 for(const effectType of effectTypes)assert.ok(validateMusicVibe({...good,effectType}));
 assert.equal(validateMusicVibe({...good,secondaryColor:'red'}),null);
 assert.equal(validateMusicVibe({...good,secondaryColor:undefined}),null);
 assert.notEqual(localMusicVibe('Never Gonna Give You Up','Rick Astley').effectType,'snow');
});
