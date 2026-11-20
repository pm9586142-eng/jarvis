import React from 'react';

interface MediaEqualizerProps {
  isPlaying: boolean;
  reducedMotion?: boolean;
  barCount?: number;
  className?: string;
}

const BAR_HEIGHTS = [0.45, 0.9, 0.65, 1.0, 0.55, 0.8];

export const MediaEqualizer: React.FC<MediaEqualizerProps> = ({
  isPlaying,
  reducedMotion = false,
  barCount = 5,
  className = '',
}) => {
  const bars = BAR_HEIGHTS.slice(0, Math.max(3, Math.min(6, barCount)));

  return (
    <div
      className={`inline-flex items-end gap-[2.5px] h-4 ${className}`}
      role="status"
      aria-label={isPlaying ? 'Media equalizer active' : 'Media equalizer paused'}
    >
      {bars.map((peak, idx) => {
        const heightPct = isPlaying ? Math.round(peak * 100) : 26;
        const duration = 0.65 + (idx % 3) * 0.22;
        const delay = idx * 0.11;
        return (
          <span
            key={idx}
            className={`w-[3px] rounded-full transition-all duration-300 ${
              isPlaying
                ? 'bg-gradient-to-t from-cyan-500 via-cyan-300 to-sky-200 shadow-[0_0_8px_rgba(0,240,255,0.65)]'
                : 'bg-slate-600'
            }`}
            style={{
              height: `${heightPct}%`,
              animation:
                isPlaying && !reducedMotion
                  ? `jarvisEqBar ${duration}s ease-in-out ${delay}s infinite alternate`
                  : undefined,
            }}
          />
        );
      })}
      <style>{`
        @keyframes jarvisEqBar {
          0% { transform: scaleY(0.28); transform-origin: bottom; }
          100% { transform: scaleY(1); transform-origin: bottom; }
        }
      `}</style>
    </div>
  );
};
