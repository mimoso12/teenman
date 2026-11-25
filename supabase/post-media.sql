-- Execute no SQL Editor do projeto Teenman. Não apaga posts ou arquivos existentes.
begin;
alter table public.posts add column if not exists media_url text,
 add column if not exists media_type text,
 add column if not exists category text not null default 'general';
-- Preserve legacy catalog posts up to 1,000 characters; new composer posts use 500.
alter table public.posts drop constraint if exists posts_content_check;
alter table public.posts drop constraint if exists teenman_post_content;
alter table public.posts add constraint teenman_post_content check (
 char_length(content)<=1000 and (char_length(trim(content))>0 or media_url is not null)
);
alter table public.posts drop constraint if exists teenman_post_media;
alter table public.posts add constraint teenman_post_media check (
 (media_url is null and media_type is null) or
 (media_url is not null and media_type is not null and media_type in ('image','video') and char_length(media_url)<=2048 and media_url ~ '^https://')
);
alter table public.posts drop constraint if exists teenman_post_category;
alter table public.posts add constraint teenman_post_category check(category in ('general','cinema','music','games','books','sports','civic'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('post-media','post-media',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists teenman_post_upload on storage.objects;
create policy teenman_post_upload on storage.objects for insert to authenticated
 with check(bucket_id='post-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists teenman_post_own_read on storage.objects;
create policy teenman_post_own_read on storage.objects for select to authenticated
 using(bucket_id='post-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
drop policy if exists teenman_post_own_delete on storage.objects;
create policy teenman_post_own_delete on storage.objects for delete to authenticated
 using(bucket_id='post-media' and (storage.foldername(name))[1]=(select auth.uid()::text));
commit;
