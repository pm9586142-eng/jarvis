import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
  Play,
  ThumbsUp,
  Youtube,
} from 'lucide-react';
import { MediaPlayerState, SmartMediaMemory } from '../types/media';
import { formatCompactNumber } from '../services/media/youtubeMediaServices';
import { MediaEqualizer } from './MediaEqualizer';

export interface MediaStageRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface YouTubePlayerStageProps {
  mediaState: MediaPlayerState;
  mediaMemory: SmartMediaMemory;
  reducedMotion: boolean;
  onPlay: () => void;
  onNext: () => void;
  onToggleFullscreen: () => void;
  onStageRectChange: (rect: MediaStageRect | null) => void;
}

/**
 * Reusable official YouTube IFrame Player Stage component.
 * Synchronizes its 16:9 viewport rect with the persistent non-reparented YouTube IFrame host
 * in App.tsx so audio/video playback never interrupts when navigating across JARVIS screens,
 * and cleanly parks the host whenever the stage scrolls off-screen or enters error/blocked states.
 */
export const YouTubePlayerStage: React.FC<YouTubePlayerStageProps> = ({
  mediaState,
  mediaMemory,
  reducedMotion,
  onPlay,
  onNext,
  onToggleFullscreen,
  onStageRectChange,
}) => {
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateRect = () => {
      const r = el.getBoundingClientRect();
      // Park persistent host cleanly if stage is scrolled behind sticky top header (~64px) or off-viewport
      const isOffscreen =
        r.width <= 20 ||
        r.height <= 20 ||
        r.bottom <= 68 ||
        r.top >= window.innerHeight ||
        r.right <= 0 ||
        r.left >= window.innerWidth;

      if (isOffscreen) {
        onStageRectChange(null);
        return;
      }

      onStageRectChange({
        top: Math.round(r.top),
        left: Math.round(r.left),
        width: Math.round(r.width),
        height: Math.round(r.height),
      });
    };

    updateRect();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateRect) : null;
    ro?.observe(el);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
      onStageRectChange(null);
    };
  }, [onStageRectChange]);

  const track = mediaState.currentTrack;
  const isPlaying = mediaState.status === 'playing';
  const showOverlay =
    !track ||
    !mediaState.isPlayerVisible ||
    mediaState.status === 'idle' ||
    mediaState.status === 'embed_blocked' ||
    mediaState.status === 'error';

  const viewsLabel = formatCompactNumber(track?.viewCount);
  const likesLabel = formatCompactNumber(track?.likeCount);

  return (
    <div className="space-y-3">
      {/* 16:9 Official YouTube IFrame Stage Slot */}
      <div
        ref={stageRef}
        data-testid="youtube-player-stage"
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-[#02050E] border border-cyan-500/30 flex items-center justify-center"
      >
        {showOverlay && (
          <div className="relative z-10 text-center p-6 max-w-md space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/12 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_24px_rgba(0,240,255,0.2)]">
              {mediaState.status === 'error' || mediaState.status === 'embed_blocked' ? (
                <AlertTriangle className="w-7 h-7 text-amber-300" />
              ) : (
                <Youtube className="w-7 h-7 text-cyan-300" />
              )}
            </div>

            {mediaState.status === 'embed_blocked' && track ? (
              <>
                <h3 className="font-display text-sm tracking-wider text-amber-200">
                  EMBEDDED PLAYBACK DISABLED BY VIDEO OWNER
                </h3>
                <p className="text-xs text-slate-300">
                  {mediaState.errorMessage ||
                    'This YouTube video cannot be embedded. Open it directly on YouTube or skip to the next track in your queue.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  <a
                    href={track.watchUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#02040A] font-mono-hud text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>OPEN ON YOUTUBE</span>
                  </a>
                  {mediaState.queue.length > 1 && (
                    <button
                      type="button"
                      onClick={onNext}
                      className="px-3.5 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-mono-hud text-xs font-bold cursor-pointer"
                    >
                      NEXT IN QUEUE
                    </button>
                  )}
                </div>
              </>
            ) : mediaState.status === 'error' ? (
              <>
                <h3 className="font-display text-sm tracking-wider text-rose-200">
                  YOUTUBE PLAYER UNAVAILABLE
                </h3>
                <p className="text-xs text-slate-300">
                  {mediaState.errorMessage ||
                    'The official YouTube embedded player could not load this video right now.'}
                </p>
                <div className="flex flex-wrap justify-center gap-2 pt-1">
                  {(track?.watchUrl || mediaState.fallbackUrl) && (
                    <a
                      href={track?.watchUrl || mediaState.fallbackUrl || 'https://www.youtube.com'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#02040A] font-mono-hud text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>OPEN ON YOUTUBE</span>
                    </a>
                  )}
                  {mediaState.queue.length > 1 && (
                    <button
                      type="button"
                      onClick={onNext}
                      className="px-3.5 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-mono-hud text-xs font-bold cursor-pointer"
                    >
                      NEXT IN QUEUE
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display text-sm tracking-wider text-cyan-200">
                  J.A.R.V.I.S. YOUTUBE PLAYER READY
                </h3>
                <p className="text-xs text-slate-400">
                  Search above or say &quot;Search Arijit Singh songs&quot;, &quot;Play Kesariya&quot;, or &quot;पहला वीडियो चलाओ&quot; to play inside JARVIS.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Honest Autoplay / Status / Fallback Banner (placed outside iframe rect so always clickable) */}
      {(mediaState.status === 'autoplay_blocked' ||
        mediaState.statusMessage ||
        mediaState.errorMessage) && (
        <div
          className={`rounded-xl px-3.5 py-2.5 border flex flex-wrap items-center justify-between gap-2 ${
            mediaState.errorMessage || mediaState.status === 'autoplay_blocked'
              ? 'bg-amber-500/12 border-amber-400/45 text-amber-100'
              : 'bg-cyan-500/10 border-cyan-400/35 text-cyan-100'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-mono-hud min-w-0">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
            <span className="break-words">
              {mediaState.errorMessage || mediaState.statusMessage}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {mediaState.status === 'autoplay_blocked' && (
              <button
                type="button"
                onClick={onPlay}
                className="px-3 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-mono-hud text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>CLICK TO PLAY</span>
              </button>
            )}
            {mediaState.fallbackUrl && (
              <a
                href={mediaState.fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 text-cyan-200 font-mono-hud text-[11px] font-bold inline-flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>OPEN ON YOUTUBE</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Active Track Info, Public Statistics & Fullscreen Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <MediaEqualizer isPlaying={isPlaying} reducedMotion={reducedMotion} barCount={5} />
            <span className="font-mono-hud text-[10px] uppercase tracking-wider text-cyan-300">
              {mediaState.status === 'playing'
                ? mediaState.isDucked
                  ? 'PLAYING • AUDIO DUCKED (20%)'
                  : 'NOW PLAYING'
                : mediaState.status.toUpperCase()}
            </span>
            {!mediaState.duckingSupported && (
              <span className="font-mono-hud text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-200">
                DEVICE VOLUME ONLY
              </span>
            )}
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
            {track ? track.title : 'No active media loaded'}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-mono-hud text-xs text-slate-400">
            <span className="truncate">
              {track
                ? `${track.channelTitle}${track.durationText ? ` • ${track.durationText}` : ''}`
                : mediaMemory.lastOpenedWebsite
                  ? `Last opened website: ${mediaMemory.lastOpenedWebsite.label}`
                  : 'Ready for voice or text command'}
            </span>
            {viewsLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300/85">
                <Eye className="w-3 h-3" />
                {viewsLabel} views
              </span>
            )}
            {likesLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300/85">
                <ThumbsUp className="w-3 h-3" />
                {likesLabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {track && (
            <button
              type="button"
              data-testid="media-fullscreen-btn"
              onClick={onToggleFullscreen}
              aria-label={mediaState.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              title={mediaState.isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              className="px-2.5 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-[11px] text-cyan-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {mediaState.isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">
                {mediaState.isFullscreen ? 'EXIT FULL' : 'FULLSCREEN'}
              </span>
            </button>
          )}
          {track && (
            <a
              href={track.watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 font-mono-hud text-[11px] text-cyan-200 inline-flex items-center gap-1.5 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>YOUTUBE</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
