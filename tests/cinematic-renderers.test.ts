import test from 'node:test';
import assert from 'node:assert/strict';
import {createCinematicCanvas,canvasFamilies,cinematicBudget,ghostbustersCue} from '../lib/cinematic-canvas';
import {horizons,defaultDirection} from '../lib/cinematic-schema';
import {localMusicVibe,validateMusicVibe,vibeCacheKey} from '../lib/music-vibe';
import {cinematicPrompt} from '../lib/cinematic-prompt';
function canvasHarness(){const operations:string[]=[],surfaces:any[]=[],queue=new Map<number,FrameRequestCallback>();let next=1;const gradient={addColorStop(){}};const context=new Proxy({},{get(_object,key){if(key==='createRadialGradient'||key==='createLinearGradient')return ()=>{operations.push(String(key));return gradient;};return (..._args:any[])=>{operations.push(String(key));};},set(_object,key,value){operations.push(`${String(key)}:${value}`);return true;}}) as CanvasRenderingContext2D;const surface=()=>{const node={width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement;surfaces.push(node);return node;};return {canvas:surface(),surfaces,operations,queue,environment:{surface,requestFrame:(callback:FrameRequestCallback)=>{const id=next++;queue.set(id,callback);return id;},cancelFrame:(id:number)=>{queue.delete(id);}},advance(stamp:number){const [id,callback]=queue.entries().next().value!;queue.delete(id);callback(stamp);return callback;}};}

test('cena estática desenha imediatamente sem RAF e redesenha após resize',()=>{
 const harness=canvasHarness(),engine=createCinematicCanvas(harness.canvas,localMusicVibe('Natal','Pentatonix'),harness.environment)!;
 engine.resize(390,844,1);engine.drawStill();assert.equal(harness.queue.size,0);assert.ok(harness.operations.includes('drawImage'));
 const before=harness.operations.length;engine.resize(844,390,1);engine.drawStill();assert.ok(harness.operations.length>before);assert.equal(harness.canvas.width,844);engine.stop();
});

test('todos os horizontes mantêm renderização Canvas com gradientes e composição luminosa',()=>{
 assert.deepEqual(Object.keys(canvasFamilies),[...horizons]);
 for(const horizon of horizons){const harness=canvasHarness(),vibe=validateMusicVibe({...localMusicVibe('Natal','Pentatonix'),horizonSilhouette:horizon})!;const engine=createCinematicCanvas(harness.canvas,vibe,harness.environment)!;engine.resize(1280,720,2);engine.start();harness.advance(16);assert.ok(harness.operations.includes('createRadialGradient'),horizon);assert.ok(harness.operations.includes('globalCompositeOperation:screen'),horizon);assert.ok(harness.operations.includes('drawImage'),horizon);engine.stop();assert.equal(harness.queue.size,0);}
});
test('uma única RAF por cena e limpeza completa bloqueiam callbacks antigos e trocas repetidas',()=>{
 const harness=canvasHarness(),vibe=localMusicVibe('Ghostbusters','Ray Parker Jr.');const engine=createCinematicCanvas(harness.canvas,vibe,harness.environment)!;engine.resize(1280,720,1);engine.start();engine.start();assert.equal(harness.queue.size,1);const stale=harness.advance(16);assert.equal(harness.queue.size,1);assert.ok(engine.stats().sprites>0);assert.ok(engine.stats().sprites<=16);engine.stop();assert.equal(harness.queue.size,0);assert.equal(engine.stats().sprites,0);assert.equal(engine.stats().particles,0);assert.ok(harness.surfaces.slice(1).every(node=>node.width===0&&node.height===0));const count=harness.operations.length;stale(32);engine.start();engine.resize(500,500,1);assert.equal(harness.operations.length,count);assert.equal(harness.queue.size,0);
 for(let i=0;i<20;i++){const fresh=createCinematicCanvas(harness.canvas,localMusicVibe(i%2?'Natal':'Numb',i%2?'Pentatonix':'Linkin Park'),harness.environment)!;fresh.resize(390,844,3);fresh.start();harness.advance(i*16);fresh.stop();assert.equal(harness.queue.size,0);}
});
test('resize libera a textura anterior e orçamento móvel limita partículas e pixels',()=>{
 const harness=canvasHarness(),engine=createCinematicCanvas(harness.canvas,localMusicVibe('Natal','Pentatonix'),harness.environment)!;engine.resize(1280,720,3);const first=harness.surfaces[1];engine.resize(390,844,3);assert.equal(first.width,0);assert.equal(engine.stats().particles,72);assert.equal(harness.canvas.width,Math.round(390*1.15));assert.equal(cinematicBudget(1600,3).dpr,1.5);engine.stop();
});
test('Ghostbusters reconhece nomes e dispara feixes e captura sem timers independentes',()=>{
 for(const [track,artist] of [['Ghostbusters','Ray Parker Jr.'],['Bustin','Artista'],['Caça-Fantasmas','Trilha'],['Faixa','Ray Parker Jr.']]){const vibe=localMusicVibe(track,artist);assert.equal(vibe.sceneTheme,'ghostbusters-show');assert.equal(vibe.horizonSilhouette,'ghostbusters-show');assert.equal(vibe.primaryColor,'#22c55e');assert.equal(vibe.secondaryColor,'#06b6d4');}
 assert.ok(cinematicPrompt.includes('ghostbusters-show'));assert.ok(vibeCacheKey('A','B').startsWith('music_vibe_v11_'));assert.equal(ghostbustersCue(1).beam,0);assert.ok(ghostbustersCue(9).beam>.5);assert.ok(ghostbustersCue(12.3).capture>.5);assert.equal(ghostbustersCue(15).target,1);
 const harness=canvasHarness(),engine=createCinematicCanvas(harness.canvas,localMusicVibe('Ghostbusters','Ray Parker Jr.'),harness.environment)!;engine.resize(1280,720);engine.start();for(let i=0;i<900;i++)harness.advance(i*16);assert.ok(harness.operations.includes('globalCompositeOperation:lighter'));assert.ok(harness.operations.includes('strokeStyle:#fb923c'));assert.ok(harness.operations.includes('strokeStyle:#60a5fa'));assert.ok(engine.stats().sprites<=16);engine.stop();
});
test('partículas reduzem densidade sob atraso sem acelerar o tempo da música',()=>{
 const harness=canvasHarness(),engine=createCinematicCanvas(harness.canvas,localMusicVibe('Chuva','Banda'),harness.environment)!;engine.resize(1280,720);engine.start();for(let i=0;i<200;i++)harness.advance(i*40);assert.ok(engine.stats().quality<.7);assert.ok(engine.stats().quality>=.45);engine.stop();
});
