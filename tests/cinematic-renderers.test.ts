import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import CinematicHorizon from '../components/cinematic-horizon';
import {SkyCenterpiece,SkyFlyer,LightingLayer} from '../components/cinematic-sky-layers';
import {horizons,centerpieces,flyers,lightingFilters} from '../lib/cinematic-schema';
test('todas as opções do contrato da IA possuem um renderizador de cenário',()=>{
 for(const kind of horizons){const markup=renderToStaticMarkup(createElement(CinematicHorizon,{kind}));if(kind==='none')assert.equal(markup,'');else{assert.ok(markup.includes('data-layer="horizon"'),kind);assert.ok(markup.includes(`data-variant="${kind}"`),kind);assert.ok(markup.includes('<svg'),kind);}}
});
test('centros, voadores e iluminação cobrem os enums da IA sem inserir scripts',()=>{
 for(const [Component,kinds,layer] of [[SkyCenterpiece,centerpieces,'centerpiece'],[SkyFlyer,flyers,'flyer'],[LightingLayer,lightingFilters,'lighting']] as const){for(const kind of kinds){const markup=renderToStaticMarkup(createElement(Component as any,{kind}));assert.equal(markup.includes('<script'),false);if(kind==='none')assert.equal(markup,'');else{assert.ok(markup.includes(`data-layer="${layer}"`),kind);assert.ok(markup.includes(`data-variant="${kind}"`),kind);}}}
});
