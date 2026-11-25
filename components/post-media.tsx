'use client';
import { useState } from 'react';
import type { Media } from '../lib/post-media';
export default function PostMedia({ media }: { media: Media }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <a className="media-fallback" href={media.url} target="_blank" rel="noopener noreferrer">Mídia indisponível. Abrir link original</a>;
  if (media.kind === 'image') return <img className="post-media-image" src={media.url} alt="Imagem compartilhada na publicação" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>;
  if (media.kind === 'video') return <video className="post-media-video" src={media.url} controls preload="metadata" onError={() => setFailed(true)}/>;
  return <iframe className="post-media-embed" src={media.url} title="Vídeo compartilhado na publicação" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"/>;
}
