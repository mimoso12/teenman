import {createLyricsService,type LyricContext} from './lyrics-service';
import {cinematicPrompt,cinematicResponseSchema} from './cinematic-prompt';
import {validateDirection} from './cinematic-schema';
import { localMusicVibe, validateMusicVibe, vibeCacheKey, type VibeResult } from './music-vibe';
type Options = { key: () => string | undefined; model?: () => string | undefined; fetcher?: typeof fetch; now?: () => number; lyrics?:(track:string,artist:string)=>Promise<LyricContext> };
export function parseMusicVibeJson(raw:string):unknown {
  const text=raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  return JSON.parse(text);
}
export function createMusicVibeService(options: Options) {
  const cache = new Map<string, { result: VibeResult; expires: number }>();
  const pending = new Map<string, Promise<VibeResult>>();
  const now = options.now || Date.now;
  const lyrics=options.lyrics||createLyricsService(fetch,now).find;
  let windowStart = 0, calls = 0, cooldown = 0, primaryUnavailableUntil = 0, warnedMissingKey=false;
  async function generate(trackName: string, artistName: string): Promise<VibeResult> {
    const key = vibeCacheKey(trackName, artistName);
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.result;
    if (pending.has(key)) return pending.get(key)!;
    const promise = (async (): Promise<VibeResult> => {
      let fallback: VibeResult = { ...localMusicVibe(trackName, artistName), source: 'fallback' };
      let result = fallback;
      if (now() - windowStart >= 60000) { windowStart = now(); calls = 0; }
      const apiKey = options.key();
      if(!apiKey&&!warnedMissingKey){console.error('[music-vibe] GEMINI_API_KEY ausente; usando análise local.');warnedMissingKey=true;}
      if (apiKey && now() >= cooldown && calls < 20 && pending.size < 5) {
        calls++;
        let lyricContext:LyricContext={lyrics:null,status:'unavailable',url:null};
        try{lyricContext=await lyrics(trackName,artistName);}catch{}
        if(lyricContext.status==='found')fallback={...fallback,lyricInspo:'Letra encontrada no LRCLIB; IA indisponível. Cena inspirada nos metadados.'};
        if(lyricContext.status==='instrumental')fallback={...fallback,lyricInspo:'Faixa instrumental no LRCLIB; direção inspirada no título e no artista.'};
        result=fallback;
        let reported=false;
        const safe=(value:unknown)=>String(value).split(apiKey).join('[REDACTED]').replace(/AIza[\w-]+/g,'[REDACTED]').slice(0,500);
        try {
          const model = options.model?.() || 'gemini-2.5-flash';
          if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new Error('model');
          let response:Response|null=null; const signal=AbortSignal.timeout(12000);
          const models=model==='gemini-2.5-flash'?(now()<primaryUnavailableUntil?['gemini-3.8-flash']:[model,'gemini-3.8-flash']):[model];
          for(let index=0;index<models.length;index++){
          if(index>0){if(calls>=20)break;calls++;}
          const candidate=models[index];
          response = await (options.fetcher || fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              systemInstruction: {parts:[{text:cinematicPrompt}]},
              contents: [{ role: 'user', parts: [{ text: JSON.stringify({ trackName, artistName, plainLyrics:lyricContext.lyrics,lyricsStatus:lyricContext.status }) }] }],
              generationConfig: {responseMimeType:'application/json',thinkingConfig:candidate.startsWith('gemini-3.')?{thinkingLevel:'LOW'}:{thinkingBudget:256},maxOutputTokens:1800,temperature:.65,responseSchema:cinematicResponseSchema},
            }), cache: 'no-store', signal,
          });
          if(response.ok)reported=false;
          if(!response.ok){
            const body=await response.text();let details:Record<string,unknown>={};try{const error=JSON.parse(body)?.error;details={code:typeof error?.code==='number'?error.code:response.status,status:safe(error?.status||response.statusText),message:safe(error?.message||response.statusText)};}catch{details={message:safe(body||response.statusText)};}
            console.error('[music-vibe] Gemini HTTP error',{model:candidate,httpStatus:response.status,...details});reported=true;
          }
          if(response.status===404&&candidate==='gemini-2.5-flash'&&index+1<models.length){primaryUnavailableUntil=now()+300000;continue;}
          break;
          }
          if (!response||!response.ok) { if(response&&[400,401,403,404,429].includes(response.status))cooldown=now()+300000;throw new Error('unavailable'); }
          const data = await response.json();
          const raw = data.candidates?.[0]?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || '').join('') || '';
          let parsed:unknown;try{parsed=parseMusicVibeJson(raw);}catch{throw new Error('JSON Gemini inválido (conteúdo omitido).');}
          const vibe = validateMusicVibe(parsed);
          if (!vibe||!validateDirection(vibe as Record<string,unknown>)) throw new Error('Resposta Gemini rejeitada: esquema inválido ou nome genérico.');
          result = { ...vibe,lyricInspo:lyricContext.status==='found'?'LRCLIB · '+vibe.lyricInspo!.slice(0,169):lyricContext.status==='instrumental'?'Faixa instrumental no LRCLIB; direção baseada nos metadados.':'Letra não encontrada; direção inspirada no título e no artista.', source: 'gemini' };
        } catch(error) { if(!reported)console.error('[music-vibe] Falha na análise Gemini; usando análise local.',{error:safe(error instanceof Error?error.message:'Erro desconhecido')}); }
      }
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(key, { result, expires: now() + (result.source === 'gemini' ? 7 * 86400000 : 10 * 60000) });
      return result;
    })();
    pending.set(key, promise);
    try { return await promise; } finally { pending.delete(key); }
  }
  return { generate };
}
