import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankPostsForUser,followingTimeline,type RankablePost} from '../lib/feedAlgorithm';
const now=Date.parse('2026-11-25T12:00:00Z');
function post(id:string,changes:Partial<RankablePost>={}):RankablePost{return {id,author_id:id,author_name:'Autor',content:'Uma publicação',created_at:'2026-11-25T12:00:00Z',likesCount:0,repostsCount:0,commentsCount:0,...changes};}
test('fórmula usa os pesos de engajamento e a gravidade exatos',()=>{const [result]=rankPostsForUser([post('a',{likesCount:2,repostsCount:3,commentsCount:4,created_at:'2026-11-25T10:00:00Z'})],{now,interactedPosts:[]});assert.equal(result.score,(2*3+3*5+4*4)/Math.pow(4,1.35));});
test('afinidade por categoria adiciona somente 25 pontos e explica a recomendação',()=>{const [result]=rankPostsForUser([post('a',{category:'cinema',content:'#Cinema Filme Avatar'})],{now,interactedPosts:[post('old',{category:'cinema',content:'#Cinema Filme Avatar'})]});assert.equal(result.score,25/Math.pow(2,1.35));assert.equal(result.affinityLabel,'Cinema');});
test('hashtags e palavras-chave funcionam com caixa e acentos; stopwords não geram afinidade',()=>{
 const rank=(content:string,history:string)=>rankPostsForUser([post('a',{content})],{now,interactedPosts:[post('old',{content:history})]})[0];assert.equal(rank('#Fantasia','#FANTASIA').affinityLabel,'#fantasia');assert.equal(rank('dragões voando','Dragões').affinityLabel,'dragoes');assert.equal(rank('para todos agora','para todos agora').affinityLabel,null);
});
test('mídia própria e pôster legado ganham 8 pontos; URL comum não ganha',()=>{
 for(const item of [post('image',{media_url:'https://example.com/photo',media_type:'image'}),post('video',{media_url:'https://example.com/v.mp4',media_type:'video'}),post('legacy',{content:'Um título\nhttps://example.com/p.jpg'})])assert.equal(rankPostsForUser([item],{now,interactedPosts:[]})[0].score,8/Math.pow(2,1.35));assert.equal(rankPostsForUser([post('link',{content:'https://example.com/page'})],{now,interactedPosts:[]})[0].score,0);
});
test('post antigo perde espaço e datas futuras/inválidas não produzem NaN',()=>{const result=rankPostsForUser([post('old',{likesCount:10,created_at:'2020-01-01'}),post('new',{likesCount:1}),post('bad',{likesCount:Infinity,created_at:'bad'}),post('future',{likesCount:1,created_at:'2030-01-01'})],{now,interactedPosts:[]});assert.ok(result.findIndex(p=>p.id==='new')<result.findIndex(p=>p.id==='old'));assert.ok(result.every(p=>Number.isFinite(p.score)));assert.equal(result.find(p=>p.id==='future')!.score,result.find(p=>p.id==='new')!.score);});
test('diversidade intercala autores após dois posts e aceita autor único sem perder posts',()=>{
 const posts=[post('a',{author_id:'same',likesCount:10}),post('b',{author_id:'same',likesCount:9}),post('c',{author_id:'same',likesCount:8}),post('other',{likesCount:1})];const result=rankPostsForUser(posts,{now,interactedPosts:[]});assert.equal(result[2].id,'other');assert.equal(result.length,4);assert.equal(new Set(result.map(p=>p.id)).size,4);assert.ok(result.find(p=>p.id==='c')!.score<(8*3)/Math.pow(2,1.35));assert.equal(rankPostsForUser(posts.slice(0,3),{now,interactedPosts:[]}).length,3);
});
test('função é determinística, não altera entradas e lida com início sem histórico',()=>{
 const input=[post('old',{created_at:'2026-11-24T12:00:00Z'}),post('new')];const snapshot=structuredClone(input),interactions={now,interactedPosts:[]};const a=rankPostsForUser(input,interactions),b=rankPostsForUser(input,interactions);assert.deepEqual(a,b);assert.deepEqual(input,snapshot);assert.equal(a[0].id,'new');assert.ok(a.every(p=>!p.affinityLabel));
});
test('Seguindo inclui republicação de autor não seguido e usa data da atividade',()=>{
 const posts=[post('direct',{author_id:'friend',created_at:'2026-11-24'}),post('shared',{author_id:'stranger',created_at:'2020-01-01'}),post('hidden',{author_id:'stranger'})];const result=followingTimeline(posts,['friend'],[{post_id:'shared',user_id:'friend',created_at:'2026-11-25'},{post_id:'hidden',user_id:'not-followed',created_at:'2026-11-26'}]);assert.deepEqual(result.map(p=>p.id),['shared','direct']);assert.equal(result[0].author_id,'stranger');assert.equal(result[0].repostedBy,'friend');
});
test('Seguindo deduplica duas republicações e usa o compartilhamento mais recente',()=>{const result=followingTimeline([post('a')],['one','two'],[{post_id:'a',user_id:'one',created_at:'2026-11-26'},{post_id:'a',user_id:'two',created_at:'2026-11-27'}]);assert.equal(result.length,1);assert.equal(result[0].repostedBy,'two');assert.deepEqual(followingTimeline([post('a')],[],[]),[]);});
