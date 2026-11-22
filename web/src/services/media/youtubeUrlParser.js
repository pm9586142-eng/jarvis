export function parseYouTubeUrlInput(rawInput) {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, '');
    if (host !== 'youtube.com' && host !== 'youtu.be' && host !== 'music.youtube.com') {
      return null;
    }

    const listId = url.searchParams.get('list')?.trim();
    const watchVid = url.searchParams.get('v')?.trim();

    if (host === 'youtu.be') {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0]?.trim();
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return { kind: 'video', videoId: id, playlistId: listId || undefined };
      }
    }

    const shortsMatch = url.pathname.match(/^\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch?.[1]) {
      return { kind: 'video', videoId: shortsMatch[1], playlistId: listId || undefined };
    }

    if (watchVid && /^[a-zA-Z0-9_-]{11}$/.test(watchVid)) {
      return { kind: 'video', videoId: watchVid, playlistId: listId || undefined };
    }

    if (listId && /^[a-zA-Z0-9_-]{10,64}$/.test(listId)) {
      return { kind: 'playlist', playlistId: listId };
    }

    return null;
  } catch {
    return null;
  }
}
