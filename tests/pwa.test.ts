import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),worker=readFileSync(new URL('public/sw.js',root),'utf8');
function harness(){
 const handlers=new Map<string,(event:any)=>void>(),stores=new Map<string,Map<string,Response>>();let offline=false,claimed=0,skipped=0;const key=(request:any)=>new URL(typeof request==='string'?request:request.url,'https://teenman.vercel.app').pathname;
 const caches={async open(name:string){if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name)!;return {async addAll(paths:string[]){for(const path of paths)store.set(path,new Response(path==='/offline.html'?'OFFLINE':'public asset'));},async put(request:any,response:Response){store.set(key(request),response);},async match(request:any){return store.get(key(request))?.clone();}};},async keys(){return [...stores.keys()];},async delete(name:string){return stores.delete(name);}};
 const fetcher=async(request:any)=>{if(offline)throw new Error('offline');return new Response(key(request)==='/feed'?'private feed':'fresh public asset');};
 vm.runInNewContext(worker,{self:{location:{origin:'https://teenman.vercel.app'},addEventListener:(name:string,handler:(event:any)=>void)=>handlers.set(name,handler),skipWaiting:async()=>{skipped++;},clients:{claim:async()=>{claimed++;}}},caches,fetch:fetcher,URL,Response});
 return {stores,setOffline(value:boolean){offline=value;},async lifecycle(name:string){let work:Promise<unknown>|undefined;handlers.get(name)!({waitUntil:(promise:Promise<unknown>)=>{work=promise;}});await work;},fetch(path:string,mode='cors',method='GET'){let response:Promise<Response>|undefined;handlers.get('fetch')!({request:{url:new URL(path,'https://teenman.vercel.app').href,mode,method},respondWith:(promise:Promise<Response>)=>{response=promise;}});return response;},get claimed(){return claimed;},get skipped(){return skipped;}};
}
test('manifesto contém identidade estável, cores pretas, escopo e ícones instaláveis',()=>{
 const manifest=JSON.parse(readFileSync(new URL('public/manifest.json',root),'utf8'));assert.equal(manifest.name,'Teenman');assert.equal(manifest.short_name,'Teenman');assert.equal(manifest.start_url,'/feed');assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');assert.equal(manifest.theme_color,'#000000');assert.equal(manifest.background_color,'#000000');assert.deepEqual(manifest.icons.map((icon:any)=>icon.sizes),['192x192','512x512']);
});
test('PNGs reais têm dimensões declaradas, fundo preto opaco e marca na área segura maskable',()=>{
 for(const [name,size] of [['icon-192.png',192],['icon-512.png',512],['apple-touch-icon.png',180]] as const){const png=readFileSync(new URL('public/'+name,root));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);const parts:Buffer[]=[];for(let i=8;i<png.length;){const n=png.readUInt32BE(i),type=png.subarray(i+4,i+8).toString();if(type==='IDAT')parts.push(png.subarray(i+8,i+8+n));i+=n+12;}const raw=inflateSync(Buffer.concat(parts));let white=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const at=y*(size*4+1)+1+x*4;assert.equal(raw[at+3],255);assert.equal(raw[at],raw[at+1]);assert.equal(raw[at],raw[at+2]);if(raw[at]>0){white++;assert.ok(Math.hypot(x-size/2,y-size/2)<size*.4);}}assert.ok(white>size*size*.03);assert.equal(raw[1],0);}
});
test('worker instala só recursos públicos e ativa sem apagar caches de outros aplicativos',async()=>{
 const h=harness();h.stores.set('teenman-pwa-v0',new Map());h.stores.set('outro-cache',new Map());await h.lifecycle('install');await h.lifecycle('activate');assert.equal(h.skipped,1);assert.equal(h.claimed,1);assert.equal(h.stores.has('teenman-pwa-v0'),false);assert.equal(h.stores.has('outro-cache'),true);assert.deepEqual([...h.stores.get('teenman-pwa-v1')!.keys()],['/offline.html','/manifest.json','/icon-192.png','/icon-512.png','/apple-touch-icon.png']);
});
test('navegações recebem a rede e fallback offline sem salvar feed ou perfil privado',async()=>{
 const h=harness();await h.lifecycle('install');assert.equal(await (await h.fetch('/feed','navigate'))!.text(),'private feed');assert.equal(h.stores.get('teenman-pwa-v1')!.has('/feed'),false);h.setOffline(true);assert.equal(await (await h.fetch('/profile','navigate'))!.text(),'OFFLINE');
});
test('APIs, OAuth, POST, Spotify e dados RSC não são interceptados nem armazenados',()=>{
 const h=harness();for(const [path,mode,method] of [['/api/spotify/search?q=rock','cors','GET'],['/auth/callback?code=private','navigate','GET'],['/feed?_rsc=test','cors','GET'],['/feed','cors','POST'],['https://open.spotify.com/embed/track/abc','navigate','GET'],['/_next/static/chunk.js','cors','GET']])assert.equal(h.fetch(path,mode,method),undefined,path);
});
test('ícones e manifesto atualizam online e continuam disponíveis sem conexão',async()=>{
 const h=harness();await h.lifecycle('install');assert.equal(await (await h.fetch('/manifest.json'))!.text(),'fresh public asset');h.setOffline(true);assert.equal(await (await h.fetch('/manifest.json'))!.text(),'fresh public asset');
});
