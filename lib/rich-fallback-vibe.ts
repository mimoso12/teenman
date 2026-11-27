import {localMusicVibe, stageDirection, validateMusicVibe, vibeCacheKey, type MusicVibe} from './music-vibe';
import {centerpieces, flyers, horizons, lightingFilters, skyEffects, emojiMotions, type SceneDirection} from './cinematic-schema';
export function musicVisualSeed(track: string, artist: string) {
  let hash = 2166136261;
  for (const character of vibeCacheKey(track, artist)) {hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619);}
  return hash >>> 0;
}
export function buildRichFallbackVibe(trackName: string, artistName: string): MusicVibe {
  const base = localMusicVibe(trackName, artistName), direction = stageDirection(base), seed = musicVisualSeed(trackName, artistName);
  let state = seed;
  const pick = <T,>(values: readonly T[]): T => {state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return values[state % values.length];};
  const thematic = /ghostbusters-show|fnaf-pizzeria|cyber-arena-hud|anime-torii-temple|christmas-village|halloween-graveyard|country-ranch|sertanejo-arena|classic-rock-stage|metal-hellfire-stage|pop-neon-city|pop-dream-clouds|rainy-street/.test(direction.horizonSilhouette);
  const variants: Partial<SceneDirection> = {emojiMotion: pick(emojiMotions)};
  if (direction.horizonSilhouette === 'christmas-village') {
    variants.skyEffect = pick(['snowfall', 'golden-dust', 'shooting-stars'] as const);
    variants.skyFlyer = pick(['santa-sleigh', 'shooting-comet', 'golden-fireworks-sky'] as const);
  } else if (direction.horizonSilhouette === 'rainy-street') {
    variants.skyEffect = pick(['heavy-rain', 'lightning-storm', 'fog-mist'] as const);
    variants.skyCenterpiece = pick(['lightning-cloud', 'crescent-moon', 'full-moon'] as const);
  } else if (direction.horizonSilhouette === 'country-ranch' || direction.horizonSilhouette === 'sertanejo-arena') {
    variants.skyEffect = pick(['golden-dust', 'shooting-stars', 'rising-embers', 'fireworks'] as const);
    variants.skyFlyer = pick(['shooting-comet', 'golden-fireworks-sky', 'neon-birds'] as const);
  } else if (thematic) {
    variants.skyEffect = pick([direction.skyEffect, 'golden-dust', 'musical-notes', 'rising-embers'] as const);
    variants.skyCenterpiece = pick([direction.skyCenterpiece, 'full-moon', 'eclipse-ring'] as const);
  } else if (/\b(noite|night|midnight|madrugada)\b/i.test(trackName.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
    variants.horizonSilhouette = pick(['cyber-city', 'rainy-street', 'mountain-peaks', 'pine-forest'] as const);
    variants.skyCenterpiece = pick(['full-moon', 'crescent-moon', 'ringed-planet'] as const);
    variants.skyEffect = pick(['shooting-stars', 'fog-mist', 'golden-dust'] as const);
    variants.skyFlyer = pick(['shooting-comet', 'cyber-drones', 'paper-planes'] as const);
  } else {
    variants.horizonSilhouette = pick(horizons.filter(value => !['none', 'ghostbusters-show', 'fnaf-pizzeria', 'christmas-village', 'halloween-graveyard'].includes(value)));
    variants.skyEffect = pick(skyEffects); variants.skyFlyer = pick(flyers.filter(value => value !== 'none'));
    variants.skyCenterpiece = pick(centerpieces); variants.lightingFilter = pick(lightingFilters);
  }
  const tintColor = (color: string, salt: number) => '#' + [1, 3, 5].map((offset, index) => {
    const component = parseInt(color.slice(offset, offset + 2), 16), variation = ((seed >>> (index * 8 + salt)) & 31) - 15;
    return Math.max(40, Math.min(245, component + variation)).toString(16).padStart(2, '0');
  }).join('');
  const primaryColor = tintColor(base.primaryColor, 0), secondaryColor = tintColor(base.secondaryColor, 3);
  const title = trackName.trim().replace(/[<>\x00-\x1f]/g, '').slice(0, 24);
  return validateMusicVibe({...base, ...direction, ...variants, visualSeed: seed,
    vibeName: (thematic?`${base.vibeName.slice(0, 32)} · ${title || artistName.slice(0, 20)}`:`Cenário de ${title} · ${artistName.slice(0, 20)}`).slice(0, 60),
    primaryColor, secondaryColor, borderColor: primaryColor,
    bgTint: `rgba(${parseInt(primaryColor.slice(1, 3), 16)},${parseInt(primaryColor.slice(3, 5), 16)},${parseInt(primaryColor.slice(5, 7), 16)},0.22)`,
  })!;
}
