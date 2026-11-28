import React, { useEffect, useRef } from 'react';
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Youtube,
} from 'lucide-react';
import { ChatMediaPayload, ChatMediaTrackRef } from '../types/jarvis';
import { MediaPlayerState } from '../types/media';
import { MediaEqualizer } from './MediaEqualizer';

interface ChatMediaDeckProps {
  payload: ChatMediaPayload;
  mediaState: MediaPlayerState;
  isFullscreenOpen: boolean;
  onPlayTrack: (track: ChatMediaTrackRef, queue?: ChatMediaTrackRef[]) => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleMute: () => void;
  onVolumeChange: (level: number) => void;
  onToggleInlineVideo: () => void;
  isInlineVideoActive: boolean;
  onUpdateStageRect: (rect: { top: number; left: number; width: number; height: number } | null) => void;
  onOpenFullscreen: (payload: ChatMediaPayload) => void;
  onCloseFullscreen: () => void;
  onOpenAmPlayer: () => void;
}

export function extractYouTubeVideoIdFromText(text: string): string | null {
  if (!text) return null;
  const match = text.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  return match?.[1] ?? null;
}

export function buildMediaPayloadFromVideoId(
  videoId: string,
  title = `YouTube Video (${videoId})`
): ChatMediaPayload {
  return {
    source: 'youtube',
    track: {
      videoId,
      title,
      channelTitle: 'YouTube Media',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    },
  };
}

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const ChatMediaDeck: React.FC<ChatMediaDeckProps> = ({
  payload,
  mediaState,
  isFullscreenOpen,
  onPlayTrack,
  onPause,
  onNext,
  onPrevious,
  onToggleMute,
  onVolumeChange,
  onToggleInlineVideo,
  isInlineVideoActive,
  onUpdateStageRect,
  onOpenFullscreen,
  onOpenAmPlayer,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { track, queue = [] } = payload;
  const isThisTrackLoaded = mediaState.currentTrack?.videoId === track.videoId;
  const isPlaying = isThisTrackLoaded && mediaState.status === 'playing';

  const progressPct =
    isThisTrackLoaded && mediaState.durationSec > 0
      ? Math.min(100, Math.max(0, (mediaState.currentTimeSec / mediaState.durationSec) * 100))
      : 0;

  useEffect(() => {
    if (!isInlineVideoActive || !isThisTrackLoaded || isFullscreenOpen) {
      return;
    }
    const updateRect = () => {
      const el = stageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const viewportH = window.innerHeight || 900;
      if (r.width > 40 && r.height > 40 && r.bottom > 96 && r.top < viewportH - 130) {
        onUpdateStageRect({
          top: Math.round(r.top),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
        });
      } else {
        onUpdateStageRect(null);
      }
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      onUpdateStageRect(null);
    };
  }, [isInlineVideoActive, isThisTrackLoaded, isFullscreenOpen, onUpdateStageRect]);

  return (
    <div
      data-testid={`chat-media-deck-${track.videoId}`}
      className="my-3 rounded-2xl border border-cyan-400/35 bg-gradient-to-br from-[#071326]/95 via-[#040915]/95 to-[#160b2e]/90 overflow-hidden shadow-[0_12px_32px_rgba(0,0,0,0.45)] max-w-2xl"
    >
      {/* Video / Artwork Stage */}
      <div
        ref={stageRef}
        className="relative w-full aspect-video bg-[#02050b] overflow-hidden border-b border-cyan-500/20"
      >
        {track.thumbnailUrl ? (
          <img
            src={track.thumbnailUrl}
            alt={track.title}
            className="w-full h-full object-cover opacity-85"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#071630] to-[#120b28]">
            <Youtube className="w-14 h-14 text-cyan-400/60" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#02050b] via-[#02050b]/30 to-transparent pointer-events-none" />

        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 border border-cyan-400/40 font-mono-hud text-[10px] text-cyan-200 backdrop-blur-sm">
            <Youtube className="w-3.5 h-3.5 text-rose-400" />
            <span>AM MEDIA DECK</span>
            {isPlaying && <MediaEqualizer isPlaying barCount={3} />}
          </span>

          {track.durationText && (
            <span className="px-2 py-0.5 rounded-md bg-black/75 border border-slate-700 font-mono-hud text-[11px] text-slate-200">
              {track.durationText}
            </span>
          )}
        </div>

        {/* Center Play Trigger when video stage isn't docked inline */}
        {(!isInlineVideoActive || !isThisTrackLoaded) && (
          <button
            type="button"
            onClick={() => {
              onPlayTrack(track, queue);
              onToggleInlineVideo();
            }}
            aria-label={`Play ${track.title}`}
            className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-cyan-400/90 hover:bg-cyan-300 text-[#02050B] flex items-center justify-center shadow-[0_0_28px_rgba(0,229,255,0.55)] cursor-pointer transition-transform hover:scale-105"
          >
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </button>
        )}

        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 pointer-events-none">
          <div className="min-w-0">
            <p className="font-display text-sm sm:text-base font-bold text-white truncate drop-shadow">
              {track.title}
            </p>
            <p className="font-mono-hud text-[11px] text-cyan-200/90 truncate">
              {track.channelTitle}
              {queue.length > 1 ? ` • Queue (${queue.length} tracks)` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Track */}
      <div className="h-1 w-full bg-slate-800/90">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-400 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Controls Bar */}
      <div className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-[#040812]/90">
        <div className="flex items-center gap-1.5">
          {queue.length > 1 && (
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous track"
              className="p-2 rounded-lg bg-[#0B162C] border border-slate-700 hover:border-cyan-400/50 text-slate-200 cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => (isPlaying ? onPause() : onPlayTrack(track, queue))}
            aria-label={isPlaying ? 'Pause media' : 'Play media'}
            className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#02050B] font-mono-hud text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>

          {queue.length > 1 && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              className="p-2 rounded-lg bg-[#0B162C] border border-slate-700 hover:border-cyan-400/50 text-slate-200 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          {isThisTrackLoaded && (
            <span className="font-mono-hud text-[11px] text-cyan-300 ml-1">
              {formatDuration(mediaState.currentTimeSec)}
              {mediaState.durationSec > 0 ? ` / ${formatDuration(mediaState.durationSec)}` : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={mediaState.isMuted ? 'Unmute media' : 'Mute media'}
            className="p-1.5 rounded-lg bg-[#0B162C] border border-slate-700 hover:border-cyan-400/50 text-cyan-300 cursor-pointer"
          >
            {mediaState.isMuted || mediaState.volume === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={mediaState.isMuted ? 0 : mediaState.volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            aria-label="Inline player volume"
            className="w-16 hidden sm:block accent-cyan-400 cursor-pointer"
          />

          <button
            type="button"
            onClick={() => {
              if (!isThisTrackLoaded) onPlayTrack(track, queue);
              onToggleInlineVideo();
            }}
            title={isInlineVideoActive && isThisTrackLoaded ? 'Dock video thumbnail' : 'Show inline video'}
            className="px-2 py-1.5 rounded-lg bg-[#0B162C] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-[10px] text-cyan-200 cursor-pointer"
          >
            {isInlineVideoActive && isThisTrackLoaded ? 'MINI' : 'VIDEO'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!isThisTrackLoaded) onPlayTrack(track, queue);
              onOpenFullscreen(payload);
            }}
            aria-label="Expand media fullscreen"
            title="Expand fullscreen"
            className="px-2.5 py-1.5 rounded-lg bg-violet-500/20 border border-violet-400/50 hover:border-violet-300 text-violet-200 font-mono-hud text-[10px] flex items-center gap-1 cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>EXPAND</span>
          </button>

          <button
            type="button"
            onClick={onOpenAmPlayer}
            title="Open AM Player"
            className="px-2 py-1.5 rounded-lg bg-[#0B162C] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-[10px] text-slate-200 cursor-pointer hidden md:inline-flex"
          >
            AM PLAYER
          </button>

          <a
            href={track.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Watch on YouTube"
            title="Open on YouTube"
            className="p-1.5 rounded-lg bg-[#0B162C] border border-slate-700 hover:border-cyan-400/60 text-slate-300 hover:text-cyan-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

interface FullscreenMediaModalProps {
  payload: ChatMediaPayload;
  mediaState: MediaPlayerState;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleMute: () => void;
  onClose: () => void;
  onUpdateStageRect: (rect: { top: number; left: number; width: number; height: number } | null) => void;
}

export const FullscreenMediaModal: React.FC<FullscreenMediaModalProps> = ({
  payload,
  mediaState,
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onToggleMute,
  onClose,
  onUpdateStageRect,
}) => {
  const modalStageRef = useRef<HTMLDivElement | null>(null);
  const track = mediaState.currentTrack || payload.track;
  const isPlaying = mediaState.status === 'playing';

  useEffect(() => {
    const update = () => {
      const el = modalStageRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        onUpdateStageRect({
          top: Math.round(r.top),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
        });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      onUpdateStageRect(null);
    };
  }, [onUpdateStageRect]);

  return (
    <div
      data-testid="chat-fullscreen-media-modal"
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-w-6xl w-full mx-auto flex-1 flex flex-col rounded-2xl border border-cyan-400/40 bg-[#030712] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-[#040915]">
          <div className="min-w-0">
            <p className="font-display text-sm sm:text-base font-bold text-cyan-200 truncate">
              {track.title}
            </p>
            <p className="font-mono-hud text-[11px] text-slate-400 truncate">
              {track.channelTitle} • AM Media Deck Fullscreen
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Exit fullscreen player"
            className="px-3 py-1.5 rounded-xl bg-[#0B162C] border border-cyan-500/40 hover:border-cyan-300 text-cyan-200 font-mono-hud text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>EXIT</span>
          </button>
        </div>

        <div ref={modalStageRef} className="flex-1 bg-black relative flex items-center justify-center min-h-[260px]">
          {track.thumbnailUrl && (
            <img
              src={track.thumbnailUrl}
              alt={track.title}
              className="max-h-full max-w-full object-contain opacity-30 pointer-events-none"
            />
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-800 bg-[#040915] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous track"
              className="p-2 rounded-xl bg-[#0D1527] border border-slate-700 text-slate-200 cursor-pointer"
            >
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={isPlaying ? onPause : onPlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#02050B] font-mono-hud text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              className="p-2 rounded-xl bg-[#0D1527] border border-slate-700 text-slate-200 cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={mediaState.isMuted ? 'Unmute' : 'Mute'}
              className="p-2 rounded-xl bg-[#0D1527] border border-slate-700 text-cyan-300 cursor-pointer"
            >
              {mediaState.isMuted ? <VolumeX className="w-4 h-4 text-amber-300" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <a
            href={track.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-xs text-cyan-200"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>OPEN ON YOUTUBE</span>
          </a>
        </div>
      </div>
    </div>
  );
};
