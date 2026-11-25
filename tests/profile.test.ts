import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedProfileImage,normalizeProfile,profileImage} from '../lib/profile';
test('imagens de perfil rejeitam SVG, HTML, arquivos vazios e excesso de tamanho',()=>{
  for(const type of ['image/jpeg','image/png','image/webp','image/gif'])assert.ok(isAllowedProfileImage({type,size:5*1024*1024}));
  for(const file of [{type:'image/svg+xml',size:100},{type:'text/html',size:100},{type:'image/png',size:0},{type:'image/jpeg',size:5*1024*1024+1}])assert.equal(isAllowedProfileImage(file),false);
});
test('links de imagem não aceitam protocolos executáveis ou credenciais',()=>{
  assert.equal(profileImage('https://example.com/avatar.jpg'),'https://example.com/avatar.jpg');
  for(const value of ['javascript:alert(1)','data:image/svg+xml,<svg/>','https://secret@example.com/avatar.jpg','http://example.com/a.jpg'])assert.equal(profileImage(value),null);
});
test('metadados antigos são compatíveis e JSON de vibe inválido não é renderizado',()=>{
  const profile=normalizeProfile({id:'test-user',display_name:'Pessoa'});
  assert.equal(profile.bio,'');assert.equal(profile.username,null);assert.equal(profile.current_ai_vibe,null);
  assert.equal(normalizeProfile({...profile,current_ai_vibe:{vibeName:'<script>'} as never}).current_ai_vibe,null);
});
