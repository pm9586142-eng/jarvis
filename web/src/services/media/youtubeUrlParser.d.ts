export interface ParsedYouTubeUrlInput {
  kind: 'video' | 'playlist';
  videoId?: string;
  playlistId?: string;
}

export function parseYouTubeUrlInput(rawInput: string): ParsedYouTubeUrlInput | null;
