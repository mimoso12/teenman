import {defaultDirection,validateDirection,legacyTheme,type SceneDirection} from './cinematic-schema';
import {fallbackDirection} from './cinematic-fallback';
export const effectTypes = ['rain','snow','fireworks','neon-aurora','siren','stars','hearts','confetti','lightning'] as const;
export const sceneThemes=['christmas-city','cyberpunk-neon','rainy-window','space-cosmos','tropical-sunset','epic-fire','love-aurora','gothic-mystery','party-festival','country-ranch','urban-street'] as const;
export type SceneTheme=typeof sceneThemes[number];
export type MusicVibe={vibeName:string;sceneTheme:SceneTheme;emojis:string[];primaryColor:string;secondaryColor:string;bgTint:string;borderColor:string;effectType:typeof effectTypes[number];glowColor:string}&Partial<SceneDirection>;
export type VibeResult=MusicVibe & {source:'gemini'|'fallback'};
export const vibeCacheKey=(track:string,artist:string)=>'music_vibe_v9_'+JSON.stringify([track.trim().normalize('NFKC').toLocaleLowerCase('pt-BR'),artist.trim().normalize('NFKC').toLocaleLowerCase('pt-BR')]);
const sceneEffects:Record<SceneTheme,MusicVibe['effectType']>={'christmas-city':'snow','cyberpunk-neon':'neon-aurora','rainy-window':'rain','space-cosmos':'stars','tropical-sunset':'neon-aurora','epic-fire':'fireworks','love-aurora':'hearts','gothic-mystery':'stars','party-festival':'confetti','country-ranch':'stars','urban-street':'neon-aurora'};
const legacyScenes:Record<MusicVibe['effectType'],SceneTheme>={rain:'rainy-window',snow:'christmas-city',fireworks:'epic-fire','neon-aurora':'cyberpunk-neon',siren:'cyberpunk-neon',stars:'space-cosmos',hearts:'love-aurora',confetti:'party-festival',lightning:'rainy-window'};
const hex=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function tint(color:string,alpha=.22){return `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},${alpha})`;}
export function validVibeTint(value:unknown):value is string{if(typeof value!=='string'||value.length>50)return false;const match=value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0(?:\.\d+)?|\.\d+)\s*\)$/);return Boolean(match&&match.slice(1,4).every(v=>Number(v)<=255)&&Number(match[4])<=.24);}
export function validateMusicVibe(value:unknown):MusicVibe|null{
 if(!value||typeof value!=='object')return null;const data=value as Record<string,unknown>;
 if(typeof data.vibeName!=='string'||data.vibeName.trim().length<2||data.vibeName.length>60||/^(na sua frequ[eê]ncia|sua vibe|vibe musical|musical vibe)$/i.test(data.vibeName.trim())||/[<>\u0000-\u001f]/.test(data.vibeName))return null;
 if(!Array.isArray(data.emojis)||data.emojis.length<2||data.emojis.length>6)return null;
 const segmenter=new Intl.Segmenter('pt-BR',{granularity:'grapheme'});
 if(!data.emojis.every(emoji=>typeof emoji==='string'&&emoji.length<=24&&[...segmenter.segment(emoji)].length===1&&/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(emoji)&&!/[<>a-zA-Z0-9]/.test(emoji)))return null;
 const emojis=[...new Set(data.emojis)] as string[];if(emojis.length<2||!hex(data.secondaryColor))return null;
 if('horizonSilhouette' in data||'lyricInspo' in data){const direction=validateDirection(data);if(!direction||emojis.length!==5||!hex(data.primaryColor)||!hex(data.borderColor)||!validVibeTint(data.bgTint))return null;const sceneTheme=legacyTheme(direction) as SceneTheme;return {vibeName:data.vibeName.trim(),emojis,primaryColor:data.primaryColor,secondaryColor:data.secondaryColor,bgTint:data.bgTint,borderColor:data.borderColor,sceneTheme,effectType:sceneEffects[sceneTheme],glowColor:data.primaryColor,...direction};}
 if(('effectType' in data&&!effectTypes.includes(data.effectType as MusicVibe['effectType']))||('glowColor' in data&&!hex(data.glowColor)))return null;
 if('sceneTheme' in data||'primaryColor' in data||'bgTint' in data||'borderColor' in data){
  if(!sceneThemes.includes(data.sceneTheme as SceneTheme)||!hex(data.primaryColor)||!hex(data.borderColor)||!validVibeTint(data.bgTint))return null;
  return {vibeName:data.vibeName.trim(),emojis,sceneTheme:data.sceneTheme as SceneTheme,primaryColor:data.primaryColor,secondaryColor:data.secondaryColor,bgTint:data.bgTint,borderColor:data.borderColor,effectType:sceneEffects[data.sceneTheme as SceneTheme],glowColor:data.primaryColor};
 }
 if(!effectTypes.includes(data.effectType as MusicVibe['effectType'])||!hex(data.glowColor))return null;
 return {vibeName:data.vibeName.trim(),emojis,sceneTheme:legacyScenes[data.effectType as MusicVibe['effectType']],primaryColor:data.glowColor,secondaryColor:data.secondaryColor,bgTint:tint(data.glowColor,.12),borderColor:data.glowColor,effectType:data.effectType as MusicVibe['effectType'],glowColor:data.glowColor};
}
function preset(sceneTheme:SceneTheme,vibeName:string,emojis:string[],primaryColor:string,secondaryColor:string,bgColor=primaryColor):MusicVibe{return {sceneTheme,vibeName,emojis,primaryColor,secondaryColor,bgTint:tint(bgColor),borderColor:primaryColor,effectType:sceneEffects[sceneTheme],glowColor:primaryColor};}
function localMusicVibeBase(track:string,artist:string):MusicVibe{
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const text=normalize(`${track} ${artist}`),artistText=normalize(artist);
 if(/\b(natal|christmas|navidad|jingle|noel|snow|winter|neve|inverno)\b/.test(text)||/\b(pentatonix|mariah(?: carey)?|(?:michael )?buble)\b/.test(artistText))return preset('christmas-city','Noite de Natal na Cidade',['❄️','🎄','✨','🎅'],'#a9dcff','#ed667f','#123263');
 if(/\b(sertanejo|modao|agronejo|country|boiadeira|rodeio)\b/.test(text)||/\b(ana castela|gusttavo(?: lima)?|jorge(?! ben)(?: & mateus| e mateus)?|marilia(?: mendonca)?|henrique(?: e juliano| & juliano)?|luan(?: santana| pereira)?|chitaozinho|xororo|morgan wallen|luke combs|johnny cash|dolly parton|willie nelson)\b/.test(artistText)||(/taylor swift/.test(artistText)&&/\b(our song|tim mcgraw|teardrops on my guitar|picture to burn|mean|fearless|love story|you belong with me)\b/.test(text)))return preset('country-ranch','Luar no Rancho · Viola & Estrada',['🤠','🎸','👢','✨','🌾'],'#e9bd70','#ad8257','#302313');
 if(/\b(funk|trap|hip[ -]?hop|rap|baile)\b/.test(text)||/\b(mc\s|mcs\s|racionais|emicida|criolo|mano brown|matue|teto|orochi|filipe ret|l7nnon|poze|anitta|ludmilla|dj arana|travis scott|kendrick lamar|drake)/.test(artistText))return preset('urban-street','Batalha de Luzes · Rua & Batida',['🔥','🎤','💎','⚡'],'#bf7aff','#4ed9e8','#251231');
 if(/\b(rock|metal|grunge|punk)\b/.test(text)||/\b(metallica|iron maiden|ac\/dc|nirvana|queen|guns n roses|linkin park|foo fighters|legiao urbana|pitty|rita lee)\b/.test(artistText))return preset('epic-fire','Palco em Chamas · Guitarras',['🔥','⚡','🎸','🌟'],'#ff9459','#e84d73','#3f1512');
 if(/\b(mpb|bossa|samba|pagode)\b/.test(text)||/\b(caetano veloso|gilberto gil|chico buarque|elis regina|gal costa|maria bethania|djavan|marisa monte|tom jobim|joao gilberto|jorge ben|seu jorge)\b/.test(artistText))return preset('tropical-sunset','Varanda Brasileira · Voz & Violão',['🌅','🎸','🌿','✨'],'#f0bb66','#83ba9c','#382714');
 if(/\b(rain|chuva|tempestade|storm|sad|saudade|blue)\b/.test(text))return preset('rainy-window','Chuva na Janela',['🌧️','🌙','💧','✨'],'#78b9e8','#a5a1e8','#14243e');
 if(/\b(space|espaco|stars?|estrela|astro|cosmos|cosmic|galaxy|galaxia|lua|moon)\b/.test(text))return preset('space-cosmos','Órbita de Sonhos',['🪐','🚀','⭐','🌌'],'#b18bff','#68d6ed','#251443');
 if(/\b(fire|fogo|chamas|epic|epico|battle|batalha|rock|metal)\b/.test(text))return preset('epic-fire','O Despertar das Chamas',['🔥','⚡','🎸','🌟'],'#ff9459','#e84d73','#3f1512');
 if(/\b(love|amor|heart|coracao|kiss|beijo|romance|paixao)\b/.test(text))return preset('love-aurora','Sob a Aurora do Amor',['💜','❤️','✨','🌷'],'#ed8fc9','#a18bed','#3e1637');
 if(/\b(party|dance|festa|festival|celebrate|happy|balada|danca|carnaval)\b/.test(text))return preset('party-festival','Festival de Luzes',['🎉','💃','✨','🎶'],'#e9bc62','#b38bfa','#301e40');
 if(/\b(tropical|sunset|verao|praia|sol|sun|beach|mar|ocean)\b/.test(text))return preset('tropical-sunset','Última Luz do Verão',['🌅','🌴','🌊','✨'],'#f0bb66','#e87991','#472816');
 if(/\b(gothic|gotico|misterio|mystery|suspense|dark|shadow|sombra|vampire|vampiro)\b/.test(text))return preset('gothic-mystery','Segredos ao Luar',['🌙','🕯️','🦇','🖤'],'#bbc2df','#927da9','#20182e');
 const title=track.trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,32)||'Som', performer=artist.trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,14)||'Palco';
 return preset('cyberpunk-neon',/\b(neon|cyber|cyberpunk|digital|synth|future|futuro)\b/.test(text)?'Horizonte Neon':`Noite de ${title} · ${performer}`,['🌃','⚡','🎵','✨'],'#b28cff','#6bdde8','#221c42');
}
export function vibeCssVariables(vibe:MusicVibe|null,active:boolean):Record<string,string>{return active&&vibe?{'--vibe-primary':vibe.primaryColor,'--vibe-secondary':vibe.secondaryColor,'--vibe-bg-tint':vibe.bgTint,'--vibe-border':vibe.borderColor,'--vibe-strength':'1'}:{'--vibe-primary':'#1d9bf0','--vibe-secondary':'#a394cf','--vibe-bg-tint':'rgba(0,0,0,0)','--vibe-border':'#27272a','--vibe-strength':'0'};}
export function localMusicVibe(track:string,artist:string):MusicVibe{const base=localMusicVibeBase(track,artist),extra=fallbackDirection(track,artist,base.sceneTheme);const primaryColor=extra.primary||base.primaryColor,secondaryColor=extra.secondary||base.secondaryColor;const emojis=[...new Set([...(extra.emojis||base.emojis),'🎶','✨','⭐'])].slice(0,5);return validateMusicVibe({...base,...extra.direction,vibeName:extra.name||base.vibeName,emojis,primaryColor,secondaryColor,borderColor:primaryColor,bgTint:extra.primary?tint(primaryColor,.24):base.bgTint})!;}
export function stageDirection(vibe:MusicVibe):SceneDirection{return validateDirection(vibe as Record<string,unknown>)||defaultDirection(vibe.sceneTheme);}
