'use client';
import { useEffect,useRef,useState,type FormEvent } from 'react';
import { Camera,X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fullProfileColumns,normalizeProfile,profileImage,isAllowedProfileImage,type ProfileData } from '../lib/profile';
import { userHandle } from '../lib/post-media';
export default function ProfileEditor({profile,open,onClose,onSaved}:{profile:ProfileData;open:boolean;onClose:()=>void;onSaved:(profile:ProfileData)=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [name,setName]=useState(profile.display_name),[username,setUsername]=useState(profile.username||userHandle(profile.display_name,profile.id).slice(1));
  const [bio,setBio]=useState(profile.bio),[category,setCategory]=useState(profile.category);
  const [avatar,setAvatar]=useState<File|null>(null),[banner,setBanner]=useState<File|null>(null);
  const [avatarPreview,setAvatarPreview]=useState<string|null>(null),[bannerPreview,setBannerPreview]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{if(open){setName(profile.display_name);setUsername(profile.username||userHandle(profile.display_name,profile.id).slice(1));setBio(profile.bio);setCategory(profile.category);setAvatar(null);setBanner(null);setMessage('');dialog.current?.showModal();}else dialog.current?.close();},[open]);
  useEffect(()=>{if(!avatar){setAvatarPreview(null);return;}const url=URL.createObjectURL(avatar);setAvatarPreview(url);return()=>URL.revokeObjectURL(url);},[avatar]);
  useEffect(()=>{if(!banner){setBannerPreview(null);return;}const url=URL.createObjectURL(banner);setBannerPreview(url);return()=>URL.revokeObjectURL(url);},[banner]);
  function fileChange(file:File|undefined,kind:'avatar'|'banner'){
    if(!file)return;
    if(!isAllowedProfileImage(file)){setMessage('Escolha uma imagem JPG, PNG, WebP ou GIF de até 5 MB.');return;}
    setMessage('');if(kind==='avatar')setAvatar(file);else setBanner(file);
  }
  async function save(event:FormEvent){
    event.preventDefault();if(!supabase||busy)return;
    const clean=username.trim().toLowerCase().replace(/^@/,'');
    if(!name.trim()||! /^[a-z0-9_]{3,24}$/.test(clean)){setMessage('Informe seu nome e um @usuario com 3 a 24 letras, números ou _.');return;}
    setBusy(true);setMessage('');const uploaded:string[]=[];let saved=false;
    try{
      const auth=await supabase.auth.getUser();if(auth.data.user?.id!==profile.id)throw new Error('session');
      async function upload(file:File|null,old:string|null){
        if(!file)return old;
        const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'} as Record<string,string>)[file.type];
        const path=`${profile.id}/${crypto.randomUUID()}.${ext}`;
        const result=await supabase!.storage.from('profile-media').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
        if(result.error)throw new Error('upload');uploaded.push(path);return supabase!.storage.from('profile-media').getPublicUrl(path).data.publicUrl;
      }
      const avatarUrl=await upload(avatar,profile.avatar_url),bannerUrl=await upload(banner,profile.banner_url);
      const result=await supabase.from('profiles').upsert({id:profile.id,display_name:name.trim(),username:clean,bio:bio.trim(),category:category.trim(),avatar_url:avatarUrl,banner_url:bannerUrl},{onConflict:'id'}).select(fullProfileColumns).single();
      if(result.error){if(result.error.code==='23505')throw new Error('username');throw new Error('profile');}
      saved=true;
      const authUpdate=await supabase.auth.updateUser({data:{display_name:name.trim()}});
      const next=normalizeProfile(result.data as unknown as ProfileData);onSaved(next);
      if(authUpdate.error)setMessage('Perfil salvo. Não foi possível atualizar o nome da sessão agora; entre novamente para sincronizar.');
      else onClose();
    }catch(error){const kind=error instanceof Error?error.message:'';setMessage(kind==='username'?'Este @usuario já está em uso. Escolha outro.':kind==='upload'?'Não foi possível enviar a imagem. Confira a conexão e tente novamente.':'Não foi possível salvar o perfil. Confira a conexão e se a atualização do perfil já foi ativada.');}
    finally{try{if(!saved&&uploaded.length)await supabase.storage.from('profile-media').remove(uploaded);}catch{}setBusy(false);}
  }
  const cover=bannerPreview||profileImage(profile.banner_url),picture=avatarPreview||profileImage(profile.avatar_url);
  return <dialog ref={dialog} className="profile-edit-dialog" aria-labelledby="profile-edit-title" onCancel={event=>{if(busy)event.preventDefault();else onClose();}} onClick={event=>{if(event.target===dialog.current&&!busy)onClose();}}><form onSubmit={save}><header><button type="button" aria-label="Fechar edição" onClick={onClose} disabled={busy}><X size={21}/></button><h2 id="profile-edit-title">Editar perfil</h2><button className="pill solid" disabled={busy}>{busy?'Salvando…':'Salvar'}</button></header><div className="edit-image-cover">{cover&&<img src={cover} alt="Prévia da capa"/>}<label className="image-upload-button" title="Enviar capa"><Camera size={23}/><span className="sr-only">Enviar imagem de capa</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event=>fileChange(event.target.files?.[0],'banner')} disabled={busy}/></label></div><div className="edit-image-avatar">{picture?<img src={picture} alt="Prévia do avatar"/>:<span>{name.slice(0,1).toUpperCase()}</span>}<label className="image-upload-button" title="Enviar avatar"><Camera size={22}/><span className="sr-only">Enviar foto do perfil</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event=>fileChange(event.target.files?.[0],'avatar')} disabled={busy}/></label></div><div className="profile-edit-fields"><label>Nome<input value={name} onChange={event=>setName(event.target.value)} maxLength={60} required disabled={busy}/></label><label>@usuario<input value={username} onChange={event=>setUsername(event.target.value)} maxLength={24} minLength={3} pattern="[a-zA-Z0-9_]{3,24}" required disabled={busy}/></label><label>Bio<textarea value={bio} onChange={event=>setBio(event.target.value)} maxLength={300} rows={3} disabled={busy}/></label><label>Categoria / Especialidade<input value={category} onChange={event=>setCategory(event.target.value)} maxLength={80} placeholder="Ex.: Escritora · Cinema e literatura" disabled={busy}/></label><small>Imagens de até 5 MB. Seu perfil e suas imagens são públicos.</small>{message&&<p className="vibe-message" role="status">{message}</p>}</div></form></dialog>;
}
