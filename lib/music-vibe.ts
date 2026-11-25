export const effectTypes = ['rain','snow','fireworks','neon-aurora','siren','stars','hearts','confetti','lightning'] as const;
export const sceneThemes=['christmas-city','cyberpunk-neon','rainy-window','space-cosmos','tropical-sunset','epic-fire','love-aurora','gothic-mystery','party-festival'] as const;
export type SceneTheme=typeof sceneThemes[number];
export type MusicVibe={vibeName:string;sceneTheme:SceneTheme;emojis:string[];primaryColor:string;secondaryColor:string;bgTint:string;borderColor:string;effectType:typeof effectTypes[number];glowColor:string};
export type VibeResult=MusicVibe & {source:'gemini'|'fallback'};
export const vibeCacheKey=(track:string,artist:string)=>JSON.stringify([track.trim().normalize('NFKC').toLocaleLowerCase('pt-BR'),artist.trim().normalize('NFKC').toLocaleLowerCase('pt-BR')]);
const sceneEffects:Record<SceneTheme,MusicVibe['effectType']>={'christmas-city':'snow','cyberpunk-neon':'neon-aurora','rainy-window':'rain','space-cosmos':'stars','tropical-sunset':'neon-aurora','epic-fire':'fireworks','love-aurora':'hearts','gothic-mystery':'stars','party-festival':'confetti'};
const legacyScenes:Record<MusicVibe['effectType'],SceneTheme>={rain:'rainy-window',snow:'christmas-city',fireworks:'epic-fire','neon-aurora':'cyberpunk-neon',siren:'cyberpunk-neon',stars:'space-cosmos',hearts:'love-aurora',confetti:'party-festival',lightning:'rainy-window'};
const hex=(value:unknown):value is string=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function tint(color:string,alpha=.22){return `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},${alpha})`;}
export function validVibeTint(value:unknown):value is string{if(typeof value!=='string'||value.length>50)return false;const match=value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0(?:\.\d+)?|\.\d+)\s*\)$/);return Boolean(match&&match.slice(1,4).every(v=>Number(v)<=255)&&Number(match[4])<=.24);}
export function validateMusicVibe(value:unknown):MusicVibe|null{
 if(!value||typeof value!=='object')return null;const data=value as Record<string,unknown>;
 if(typeof data.vibeName!=='string'||data.vibeName.trim().length<2||data.vibeName.length>60||/[<>\u0000-\u001f]/.test(data.vibeName))return null;
 if(!Array.isArray(data.emojis)||data.emojis.length<2||data.emojis.length>6)return null;
 const segmenter=new Intl.Segmenter('pt-BR',{granularity:'grapheme'});
 if(!data.emojis.every(emoji=>typeof emoji==='string'&&emoji.length<=24&&[...segmenter.segment(emoji)].length===1&&/[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(emoji)&&!/[<>a-zA-Z0-9]/.test(emoji)))return null;
 const emojis=[...new Set(data.emojis)] as string[];if(emojis.length<2||!hex(data.secondaryColor))return null;
 if(('effectType' in data&&!effectTypes.includes(data.effectType as MusicVibe['effectType']))||('glowColor' in data&&!hex(data.glowColor)))return null;
 if('sceneTheme' in data||'primaryColor' in data||'bgTint' in data||'borderColor' in data){
  if(!sceneThemes.includes(data.sceneTheme as SceneTheme)||!hex(data.primaryColor)||!hex(data.borderColor)||!validVibeTint(data.bgTint))return null;
  return {vibeName:data.vibeName.trim(),emojis,sceneTheme:data.sceneTheme as SceneTheme,primaryColor:data.primaryColor,secondaryColor:data.secondaryColor,bgTint:data.bgTint,borderColor:data.borderColor,effectType:sceneEffects[data.sceneTheme as SceneTheme],glowColor:data.primaryColor};
 }
 if(!effectTypes.includes(data.effectType as MusicVibe['effectType'])||!hex(data.glowColor))return null;
 return {vibeName:data.vibeName.trim(),emojis,sceneTheme:legacyScenes[data.effectType as MusicVibe['effectType']],primaryColor:data.glowColor,secondaryColor:data.secondaryColor,bgTint:tint(data.glowColor,.12),borderColor:data.glowColor,effectType:data.effectType as MusicVibe['effectType'],glowColor:data.glowColor};
}
function preset(sceneTheme:SceneTheme,vibeName:string,emojis:string[],primaryColor:string,secondaryColor:string,bgColor=primaryColor):MusicVibe{return {sceneTheme,vibeName,emojis,primaryColor,secondaryColor,bgTint:tint(bgColor),borderColor:primaryColor,effectType:sceneEffects[sceneTheme],glowColor:primaryColor};}
export function localMusicVibe(track:string,artist:string):MusicVibe{
 const text=`${track} ${artist}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(/\b(natal|christmas|navidad|jingle|noel|snow|winter|neve|inverno)\b/.test(text))return preset('christmas-city','Noite de Natal na Cidade',['❄️','🎄','✨','🎅'],'#a9dcff','#ed667f','#123263');
 if(/\b(rain|chuva|tempestade|storm|sad|saudade|blue)\b/.test(text))return preset('rainy-window','Chuva na Janela',['🌧️','🌙','💧','✨'],'#78b9e8','#a5a1e8','#14243e');
 if(/\b(space|espaco|stars?|estrela|astro|cosmos|cosmic|galaxy|galaxia|lua|moon)\b/.test(text))return preset('space-cosmos','Órbita de Sonhos',['🪐','🚀','⭐','🌌'],'#b18bff','#68d6ed','#251443');
 if(/\b(fire|fogo|chamas|epic|epico|battle|batalha|rock|metal)\b/.test(text))return preset('epic-fire','O Despertar das Chamas',['🔥','⚡','🎸','🌟'],'#ff9459','#e84d73','#3f1512');
 if(/\b(love|amor|heart|coracao|kiss|beijo|romance|paixao)\b/.test(text))return preset('love-aurora','Sob a Aurora do Amor',['💜','❤️','✨','🌷'],'#ed8fc9','#a18bed','#3e1637');
 if(/\b(party|dance|festa|festival|celebrate|happy|balada|danca|carnaval)\b/.test(text))return preset('party-festival','Festival de Luzes',['🎉','💃','✨','🎶'],'#e9bc62','#b38bfa','#301e40');
 if(/\b(tropical|sunset|verao|praia|sol|sun|beach|mar|ocean)\b/.test(text))return preset('tropical-sunset','Última Luz do Verão',['🌅','🌴','🌊','✨'],'#f0bb66','#e87991','#472816');
 if(/\b(gothic|gotico|misterio|mystery|suspense|dark|shadow|sombra|vampire|vampiro)\b/.test(text))return preset('gothic-mystery','Segredos ao Luar',['🌙','🕯️','🦇','🖤'],'#bbc2df','#927da9','#20182e');
 return preset('cyberpunk-neon',/\b(neon|cyber|cyberpunk|digital|synth|future|futuro)\b/.test(text)?'Horizonte Neon':'Na Sua Frequência',['🌃','⚡','🎵','✨'],'#b28cff','#6bdde8','#221c42');
}
export function vibeCssVariables(vibe:MusicVibe|null,active:boolean):Record<string,string>{return active&&vibe?{'--vibe-primary':vibe.primaryColor,'--vibe-secondary':vibe.secondaryColor,'--vibe-bg-tint':vibe.bgTint,'--vibe-border':vibe.borderColor,'--vibe-strength':'1'}:{'--vibe-primary':'#1d9bf0','--vibe-secondary':'#a394cf','--vibe-bg-tint':'rgba(0,0,0,0)','--vibe-border':'#27272a','--vibe-strength':'0'};}
