export const effectTypes = ['rain','snow','fireworks','neon-aurora','siren','stars','hearts','confetti','lightning'] as const;
export type MusicVibe = { vibeName: string; emojis: string[]; effectType: typeof effectTypes[number]; glowColor: string; secondaryColor: string };
export type VibeResult = MusicVibe & { source: 'gemini' | 'fallback' };
export const vibeCacheKey = (track: string, artist: string) => JSON.stringify([track.trim().normalize('NFKC').toLocaleLowerCase('pt-BR'), artist.trim().normalize('NFKC').toLocaleLowerCase('pt-BR')]);
export function validateMusicVibe(value: unknown): MusicVibe | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.vibeName !== 'string' || data.vibeName.trim().length < 2 || data.vibeName.length > 60 || /[<>\u0000-\u001f]/.test(data.vibeName)) return null;
  if (!Array.isArray(data.emojis) || data.emojis.length < 2 || data.emojis.length > 6) return null;
  const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });
  if (!data.emojis.every(emoji => typeof emoji === 'string' && emoji.length <= 24 && [...segmenter.segment(emoji)].length === 1 && /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(emoji) && !/[<>a-zA-Z0-9]/.test(emoji))) return null;
  if (!effectTypes.includes(data.effectType as MusicVibe['effectType']) || typeof data.glowColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.glowColor) || typeof data.secondaryColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(data.secondaryColor)) return null;
  const unique = [...new Set(data.emojis)] as string[];
  if (unique.length < 2) return null;
  return { vibeName: data.vibeName.trim(), emojis: unique, effectType: data.effectType as MusicVibe['effectType'], glowColor: data.glowColor, secondaryColor: data.secondaryColor };
}
export function localMusicVibe(track: string, artist: string): MusicVibe {
  const text = `${track} ${artist}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/rain|chuva|sad|blue|saudade/.test(text)) return { vibeName:'Noite & Companhia',emojis:['🌧️','🌙','💧','✨'],effectType:'rain',glowColor:'#729bc5',secondaryColor:'#b1b7e4' };
  if (/\b(snow|winter|neve|inverno)\b/.test(text)) return { vibeName:'Inverno em Cena',emojis:['❄️','🌨️','🤍','✨'],effectType:'snow',glowColor:'#c3e5f3',secondaryColor:'#929fcf' };
  if (/space|star|moon|astro|cosmic|galaxy|lua/.test(text)) return { vibeName:'Órbita Sonora',emojis:['🪐','🚀','⭐','🌌'],effectType:'stars',glowColor:'#ad8dff',secondaryColor:'#71b4d9' };
  if (/siren|police|sirene|alert|action/.test(text)) return { vibeName:'Sirene & Ação',emojis:['🚨','⚡','🕶️','🔥'],effectType:'siren',glowColor:'#dd5566',secondaryColor:'#557be3' };
  if (/thunder|lightning|storm|tempestade/.test(text)) return { vibeName:'Força da Tempestade',emojis:['⚡','🌩️','🌧️','💫'],effectType:'lightning',glowColor:'#a5bce5',secondaryColor:'#b5a4d7' };
  if (/fire|rock|epic|battle/.test(text)) return { vibeName:'Luzes & Ação',emojis:['🔥','⚡','🎸','🌟'],effectType:'fireworks',glowColor:'#f2b265',secondaryColor:'#db768e' };
  if (/love|amor|heart|kiss|romance/.test(text)) return { vibeName:'Coração em Cena',emojis:['💜','🌷','✨','💫'],effectType:'hearts',glowColor:'#ce8dad',secondaryColor:'#a89ade' };
  if (/party|dance|festa|celebrate|happy/.test(text)) return { vibeName:'Celebre o Agora',emojis:['🎉','💃','✨','🎶'],effectType:'confetti',glowColor:'#e5ba79',secondaryColor:'#b49edb' };
  return { vibeName:'Na Sua Frequência',emojis:['🎵','✨','💫','🎶'],effectType:'neon-aurora',glowColor:'#94b9da',secondaryColor:'#a394cf' };
}
