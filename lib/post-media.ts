export type Media = { kind: 'image' | 'video' | 'embed'; url: string };
export function mediaFromUrl(value: string): Media | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (url.hostname === 'i.scdn.co' && /^\/image\/[a-zA-Z0-9]+$/.test(url.pathname)) return { kind: 'image', url: url.href };
    if (/\.(png|jpe?g|gif|webp|avif)$/i.test(url.pathname)) return { kind: 'image', url: url.href };
    if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return { kind: 'video', url: url.href };
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1];
      if (id && /^[\w-]{11}$/.test(id)) return { kind: 'embed', url: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      const id = url.pathname.match(/(?:\/video)?\/(\d+)\/?$/)?.[1];
      if (id) return { kind: 'embed', url: `https://player.vimeo.com/video/${id}` };
    }
  } catch { /* Plain text and invalid URLs are never embedded. */ }
  return null;
}
export function splitPost(content: string): { text: string; media: Media | null } {
  const lines = content.trimEnd().split('\n');
  const media = mediaFromUrl(lines[lines.length - 1]);
  return { text: media ? lines.slice(0, -1).join('\n').trimEnd() : content, media };
}
export function userHandle(name: string, id: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16) || 'membro';
  return `@${slug}_${id.slice(0, 4)}`;
}
