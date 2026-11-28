import React from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Maximize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { MediaPlayerState } from '../types/media';
import { MediaEqualizer } from './MediaEqualizer';

interface MediaMiniPlayerProps {
  mediaState: MediaPlayerState;
  reducedMotion?: boolean;
  bottomOffsetClass?: string;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleMute: () => void;
  onVolumeChange: (level: number) => void;
  onExpandToMediaView: () => void;
  onClosePlayer: () => void;
}

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const rem = total % 60;
  return `${mins}:${String(rem).padStart(2, '0')}`;
}

export const MediaMiniPlayer: React.FC<MediaMiniPlayerProps> = ({
  mediaState,
  reducedMotion = false,
  bottomOffsetClass = 'bottom-4',
  onPlay,
  onPause,
  onNext,
  onPrevious,
  onToggleMute,
  onVolumeChange,
  onExpandToMediaView,
  onClosePlayer,
}) => {
  const track = mediaState.currentTrack;
  if (!mediaState.isPlayerVisible || !track) return null;

  const isPlaying = mediaState.status === 'playing';
  const isBlocked =
    mediaState.status === 'autoplay_blocked' ||
    mediaState.status === 'embed_blocked' ||
    mediaState.status === 'error';
  const progressPct =
    mediaState.durationSec > 0
      ? Math.min(100, Math.max(0, (mediaState.currentTimeSec / mediaState.durationSec) * 100))
      : 0;

  return (
    <div
      data-testid="jarvis-media-mini-player"
      className={`fixed ${bottomOffsetClass} right-4 left-4 sm:left-auto sm:w-[440px] z-40 rounded-2xl bg-[#040A16]/95 backdrop-blur-xl border border-cyan-400/45 shadow-[0_12px_40px_rgba(0,0,0,0.75),0_0_24px_rgba(0,240,255,0.18)] overflow-hidden`}
    >
      {/* Slim HUD Progress Track */}
      <div className="h-1 w-full bg-slate-800/90">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-sky-300 to-violet-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-center gap-3">
          {track.thumbnailUrl ? (
            <img
              src={track.thumbnailUrl}
              alt={track.title}
              className="w-12 h-12 rounded-xl object-cover border border-cyan-400/35 shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-400/35 flex items-center justify-center shrink-0">
              <MediaEqualizer isPlaying={isPlaying} reducedMotion={reducedMotion} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <MediaEqualizer isPlaying={isPlaying} reducedMotion={reducedMotion} barCount={4} />
              <span className="font-mono-hud text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                {mediaState.status === 'playing'
                  ? mediaState.isDucked
                    ? 'PLAYING • DUCKED'
                    : 'PLAYING'
                  : mediaState.status === 'paused'
                    ? 'PAUSED'
                    : mediaState.status === 'autoplay_blocked'
                      ? 'TAP TO PLAY'
                      : mediaState.status === 'embed_blocked'
                        ? 'EMBED BLOCKED'
                        : mediaState.status === 'error'
                          ? 'PLAYER ERROR'
                          : mediaState.status.toUpperCase()}
              </span>
              {mediaState.queue.length > 1 && (
                <span className="font-mono-hud text-[9px] text-slate-400">
                  {mediaState.currentIndex + 1}/{mediaState.queue.length}
                </span>
              )}
            </div>

            <p className="text-xs font-semibold text-slate-100 truncate mt-0.5" title={track.title}>
              {track.title}
            </p>
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono-hud text-slate-400">
              <span className="truncate">{track.channelTitle}</span>
              <span className="shrink-0 text-cyan-300/80">
                {formatSec(mediaState.currentTimeSec)}
                {mediaState.durationSec > 0 ? ` / ${formatSec(mediaState.durationSec)}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onExpandToMediaView}
              aria-label="Open Media Control HUD"
              title="Open Media & Web Control HUD"
              className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/60 text-cyan-300 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onClosePlayer}
              aria-label="Close media player"
              title="Close Media Player"
              className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-rose-400/60 text-slate-300 hover:text-rose-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Honest fallback banner if autoplay, embed, or player errored */}
        {isBlocked && (
          <div className="rounded-lg bg-amber-500/15 border border-amber-400/45 px-2.5 py-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <p className="font-mono-hud text-[10px] text-amber-100 truncate">
                {mediaState.status === 'embed_blocked'
                  ? 'Embed disabled by owner.'
                  : mediaState.status === 'error'
                    ? mediaState.errorMessage || 'YouTube player error.'
                    : 'Browser blocked autoplay. Click Play.'}
              </p>
            </div>
            {mediaState.status === 'embed_blocked' || mediaState.status === 'error' ? (
              <a
                href={track.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-400 text-[#02040A] font-mono-hud text-[10px] font-bold"
              >
                <ExternalLink className="w-3 h-3" />
                <span>YOUTUBE</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={onPlay}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-400 text-[#02040A] font-mono-hud text-[10px] font-bold cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>PLAY</span>
              </button>
            )}
          </div>
        )}

        {/* Controls Bar */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous track"
              className="p-2 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/50 text-slate-200 cursor-pointer"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={isPlaying ? onPause : onPlay}
              aria-label={isPlaying ? 'Pause media' : 'Play media'}
              className="px-3.5 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-[#02040A] font-mono-hud text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-[0_0_14px_rgba(0,240,255,0.35)]"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              className="p-2 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/50 text-slate-200 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={mediaState.isMuted ? 'Unmute media' : 'Mute media'}
              className="p-1.5 rounded-lg bg-[#0D1527] border border-slate-700 hover:border-cyan-400/50 text-cyan-300 cursor-pointer"
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
              aria-label="Mini player volume"
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="w-20 accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
