export const horizons=['ghostbusters-show','fnaf-pizzeria','cyber-arena-hud','anime-torii-temple','christmas-village','halloween-graveyard','country-ranch','sertanejo-arena','classic-rock-stage','metal-hellfire-stage','pop-neon-city','pop-dream-clouds','cyber-city','ocean-waves','pine-forest','medieval-castle','desert-dunes','stadium-lights','tropical-beach','rainy-street','mountain-peaks','ferris-wheel-park','none'] as const;
export const centerpieces=['security-cam-hud','gamer-crosshair','full-moon','blood-moon','crescent-moon','golden-sunset','ringed-planet','disco-ball','neon-heart','aurora-crown','christmas-star','eclipse-ring','lightning-cloud','none'] as const;
export const flyers=['animatronic-dancers','cyber-drones','energy-slashes','santa-sleigh','witch-broom-bats','shooting-comet','golden-fireworks-sky','guitar-lightning','neon-birds','paper-planes','none'] as const;
export const lightingFilters=['pizzeria-neon-flicker','aurora-borealis','christmas-string-lights','halloween-spooky-mist','concert-spotlights','rodeo-pyrotechnics','nebula-glow','warm-bokeh','cyber-grid','storm-flash','none'] as const;
export const skyEffects=['arcade-sparks','snowfall','heavy-rain','lightning-storm','shooting-stars','fireworks','rising-embers','floating-petals','neon-lasers','sunbeams','bubbles','autumn-leaves','golden-dust','matrix-rain','fog-mist','musical-notes','hearts-float','spooky-bats','confetti-burst'] as const;
export const emojiMotions=['fall-sway','rise-float','orbit-dance','pulse-burst','drift-across','spiral-vortex'] as const;
export const directionEnums={horizonSilhouette:horizons,skyCenterpiece:centerpieces,skyFlyer:flyers,lightingFilter:lightingFilters,skyEffect:skyEffects,emojiMotion:emojiMotions};
export type SceneDirection={horizonSilhouette:typeof horizons[number];skyCenterpiece:typeof centerpieces[number];skyFlyer:typeof flyers[number];lightingFilter:typeof lightingFilters[number];skyEffect:typeof skyEffects[number];emojiMotion:typeof emojiMotions[number];lyricInspo:string};
export const sceneCombinationCount=Object.values(directionEnums).reduce((count,values)=>count*values.length,1);
export function validateDirection(data:Record<string,unknown>):SceneDirection|null{
 for(const [key,values] of Object.entries(directionEnums))if(!(values as readonly unknown[]).includes(data[key]))return null;
 if(typeof data.lyricInspo!=='string'||data.lyricInspo.trim().length<3||data.lyricInspo.length>180||/[<>\u0000-\u001f]/.test(data.lyricInspo))return null;
 return Object.fromEntries([...Object.keys(directionEnums).map(key=>[key,data[key]]),['lyricInspo',data.lyricInspo.trim()]]) as SceneDirection;
}
export function defaultDirection(theme:string):SceneDirection{
 const defaults:SceneDirection={horizonSilhouette:'cyber-city',skyCenterpiece:'eclipse-ring',skyFlyer:'cyber-drones',lightingFilter:'cyber-grid',skyEffect:'neon-lasers',emojiMotion:'drift-across',lyricInspo:'Sem letra confirmada; visual inspirado no título e no artista.'};
 const scenes:Record<string,Partial<SceneDirection>>={
 'ghostbusters-show':{horizonSilhouette:'ghostbusters-show',skyCenterpiece:'full-moon',skyFlyer:'energy-slashes',lightingFilter:'storm-flash',skyEffect:'fog-mist',emojiMotion:'orbit-dance'},
 'christmas-city':{horizonSilhouette:'christmas-village',skyCenterpiece:'christmas-star',skyFlyer:'santa-sleigh',lightingFilter:'christmas-string-lights',skyEffect:'snowfall',emojiMotion:'fall-sway'},
 'country-ranch':{horizonSilhouette:'country-ranch',skyCenterpiece:'full-moon',skyFlyer:'shooting-comet',lightingFilter:'warm-bokeh',skyEffect:'shooting-stars',emojiMotion:'rise-float'},
 'urban-street':{horizonSilhouette:'pop-neon-city',skyCenterpiece:'disco-ball',skyFlyer:'cyber-drones',lightingFilter:'cyber-grid',skyEffect:'neon-lasers',emojiMotion:'pulse-burst'},
 'rainy-window':{horizonSilhouette:'rainy-street',skyCenterpiece:'lightning-cloud',skyFlyer:'none',lightingFilter:'storm-flash',skyEffect:'heavy-rain',emojiMotion:'fall-sway'},
 'space-cosmos':{horizonSilhouette:'mountain-peaks',skyCenterpiece:'ringed-planet',skyFlyer:'shooting-comet',lightingFilter:'nebula-glow',skyEffect:'shooting-stars',emojiMotion:'orbit-dance'},
 'tropical-sunset':{horizonSilhouette:'tropical-beach',skyCenterpiece:'golden-sunset',skyFlyer:'neon-birds',lightingFilter:'warm-bokeh',skyEffect:'sunbeams',emojiMotion:'drift-across'},
 'epic-fire':{horizonSilhouette:'metal-hellfire-stage',skyCenterpiece:'lightning-cloud',skyFlyer:'guitar-lightning',lightingFilter:'storm-flash',skyEffect:'rising-embers',emojiMotion:'rise-float'},
 'love-aurora':{horizonSilhouette:'pop-dream-clouds',skyCenterpiece:'neon-heart',skyFlyer:'paper-planes',lightingFilter:'aurora-borealis',skyEffect:'hearts-float',emojiMotion:'rise-float'},
 'gothic-mystery':{horizonSilhouette:'halloween-graveyard',skyCenterpiece:'blood-moon',skyFlyer:'witch-broom-bats',lightingFilter:'halloween-spooky-mist',skyEffect:'spooky-bats',emojiMotion:'spiral-vortex'},
 'party-festival':{horizonSilhouette:'ferris-wheel-park',skyCenterpiece:'disco-ball',skyFlyer:'golden-fireworks-sky',lightingFilter:'concert-spotlights',skyEffect:'confetti-burst',emojiMotion:'pulse-burst'}};
 return {...defaults,...scenes[theme]};
}
export function legacyTheme(direction:SceneDirection){const h=direction.horizonSilhouette;return h==='ghostbusters-show'?'ghostbusters-show':h==='christmas-village'?'christmas-city':h==='country-ranch'||h==='sertanejo-arena'?'country-ranch':h==='halloween-graveyard'||h==='fnaf-pizzeria'?'gothic-mystery':h==='classic-rock-stage'||h==='metal-hellfire-stage'?'epic-fire':h==='pop-dream-clouds'?'love-aurora':h==='pop-neon-city'?'urban-street':h==='rainy-street'?'rainy-window':h==='tropical-beach'||h==='ocean-waves'||h==='desert-dunes'?'tropical-sunset':h==='ferris-wheel-park'||h==='stadium-lights'?'party-festival':direction.skyCenterpiece==='ringed-planet'?'space-cosmos':'cyberpunk-neon';}
