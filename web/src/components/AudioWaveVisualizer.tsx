import React, { useEffect, useId, useRef } from 'react';

interface AudioWaveVisualizerProps {
  audioLevel: number; // 0 to 1 real-time RMS volume
  isActive: boolean;
  mode?: 'listening' | 'speaking' | 'processing' | 'executing' | 'playing' | 'paused' | 'standby';
  reducedMotion?: boolean;
}

const SVG_WIDTH = 600;
const SVG_HEIGHT = 84;
const MID_Y = SVG_HEIGHT / 2;
const SAMPLE_POINTS = 64;

function buildSmoothWavePath(
  phase: number,
  amplitude: number,
  freqMultiplier: number,
  phaseOffset: number,
  closedArea = false
): string {
  const pts: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= SAMPLE_POINTS; i++) {
    const t = i / SAMPLE_POINTS;
    const x = t * SVG_WIDTH;
    // Taper smoothly at left & right edges using a Hann window
    const envelope = Math.sin(t * Math.PI);
    const wave1 = Math.sin(t * Math.PI * 4 * freqMultiplier + phase + phaseOffset);
    const wave2 = 0.45 * Math.sin(t * Math.PI * 9 * freqMultiplier - phase * 1.45 + phaseOffset);
    const wave3 = 0.25 * Math.cos(t * Math.PI * 15 + phase * 2.1);

    const y = MID_Y + (wave1 + wave2 + wave3) * 0.58 * amplitude * envelope * (MID_Y - 8);
    pts.push({ x, y });
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const cx = ((curr.x + next.x) / 2).toFixed(1);
    const cy = ((curr.y + next.y) / 2).toFixed(1);
    d += ` Q ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}, ${cx} ${cy}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;

  if (closedArea) {
    d += ` L ${SVG_WIDTH} ${MID_Y} L 0 ${MID_Y} Z`;
  }
  return d;
}

export const AudioWaveVisualizer: React.FC<AudioWaveVisualizerProps> = ({
  audioLevel,
  isActive,
  mode,
  reducedMotion = false,
}) => {
  const effectiveMode = mode || (isActive ? 'listening' : 'standby');
  const uid = useId().replace(/:/g, '');
  const gradPrimaryId = `jarvis-wave-primary-${uid}`;
  const gradSecondaryId = `jarvis-wave-secondary-${uid}`;
  const gradFillId = `jarvis-wave-fill-${uid}`;
  const glowFilterId = `jarvis-wave-glow-${uid}`;

  const targetLevelRef = useRef(audioLevel);
  const activeRef = useRef(isActive);
  const smoothedLevelRef = useRef(0.06);
  const phaseRef = useRef(0);

  const primaryPathRef = useRef<SVGPathElement | null>(null);
  const secondaryPathRef = useRef<SVGPathElement | null>(null);
  const fillPathRef = useRef<SVGPathElement | null>(null);
  const gainLabelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    targetLevelRef.current = Math.min(1, Math.max(0, audioLevel));
  }, [audioLevel]);

  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  const applyFrameToDom = (phase: number, amplitude: number, displayPct: number) => {
    primaryPathRef.current?.setAttribute(
      'd',
      buildSmoothWavePath(phase, amplitude, 1, 0, false)
    );
    secondaryPathRef.current?.setAttribute(
      'd',
      buildSmoothWavePath(-phase * 0.82, amplitude * 0.68, 1.35, 1.7, false)
    );
    fillPathRef.current?.setAttribute(
      'd',
      buildSmoothWavePath(phase, amplitude, 1, 0, true)
    );
    if (gainLabelRef.current) {
      gainLabelRef.current.textContent = `GAIN: ${displayPct}%`;
    }
  };

  useEffect(() => {
    if (!reducedMotion) return;
    const clamped = Math.min(1, Math.max(0, audioLevel));
    const staticAmp = isActive ? Math.max(0.22, clamped) : 0.06;
    applyFrameToDom(0.6, staticAmp, Math.round(clamped * 100));
  }, [reducedMotion, isActive, audioLevel]);

  useEffect(() => {
    if (reducedMotion) return;

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const active = activeRef.current;
      const raw = targetLevelRef.current;
      // React briskly to real-time mic RMS; animate gentle vocal cadence if TTS is speaking with 0 RMS
      const goal = active
        ? raw > 0.02
          ? Math.min(1, 0.14 + raw * 0.95)
          : 0.24 + 0.08 * Math.sin(now * 0.009)
        : 0.05;

      // Fast attack, smooth decay
      const smoothing = goal > smoothedLevelRef.current ? 0.32 : 0.14;
      smoothedLevelRef.current += (goal - smoothedLevelRef.current) * smoothing;

      const speed = active ? 5.2 + smoothedLevelRef.current * 7.5 : 1.4;
      phaseRef.current += dt * speed;

      applyFrameToDom(
        phaseRef.current,
        smoothedLevelRef.current,
        Math.round(raw * 100)
      );

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reducedMotion]);

  return (
    <div
      className="w-full rounded-xl bg-[#040812]/90 border border-slate-800/90 px-3 py-2 space-y-1"
      aria-label="Real-time audio waveform visualizer"
    >
      <div className="flex items-center justify-between font-mono-hud text-[10px] text-slate-400 px-1">
        <span
          className={
            effectiveMode === 'speaking'
              ? 'text-amber-300'
              : effectiveMode === 'processing'
                ? 'text-violet-300'
                : effectiveMode === 'executing'
                  ? 'text-emerald-300'
                  : effectiveMode === 'playing'
                    ? 'text-sky-300'
                    : effectiveMode === 'paused'
                      ? 'text-amber-200'
                      : isActive
                        ? 'text-cyan-300'
                        : 'text-slate-500'
          }
        >
          {effectiveMode === 'speaking'
            ? 'VOCAL SYNTHESIS WAVE • SPEAKING'
            : effectiveMode === 'processing'
              ? 'NEURAL COGNITION • PROCESSING'
              : effectiveMode === 'executing'
                ? 'COMMAND ROUTER • EXECUTING'
                : effectiveMode === 'playing'
                  ? 'MEDIA STREAM MATRIX • PLAYING'
                  : effectiveMode === 'paused'
                    ? 'MEDIA STREAM MATRIX • PAUSED'
                    : isActive
                      ? 'ACOUSTIC MIC MATRIX • LISTENING'
                      : 'ACOUSTIC WAVEFORM • STANDBY'}
        </span>
        <span ref={gainLabelRef} className="text-cyan-300/90">
          GAIN: {Math.round(Math.min(1, Math.max(0, audioLevel)) * 100)}%
        </span>
      </div>

      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        preserveAspectRatio="none"
        className="w-full h-16 overflow-visible"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradPrimaryId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.65" />
            <stop offset="35%" stopColor="#00F0FF" stopOpacity="1" />
            <stop offset="65%" stopColor="#7DD3FC" stopOpacity="1" />
            <stop offset="100%" stopColor="#0099FF" stopOpacity="0.65" />
          </linearGradient>

          <linearGradient id={gradSecondaryId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0099FF" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#A78BFA" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient id={gradFillId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.02" />
          </linearGradient>

          <filter id={glowFilterId} x="-10%" y="-40%" width="120%" height="180%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Center Horizon Line */}
        <line
          x1="0"
          y1={MID_Y}
          x2={SVG_WIDTH}
          y2={MID_Y}
          stroke="rgba(148, 163, 184, 0.18)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />

        {/* Ambient Area Fill */}
        <path
          ref={fillPathRef}
          d={buildSmoothWavePath(0, 0.06, 1, 0, true)}
          fill={`url(#${gradFillId})`}
        />

        {/* Secondary Counter-Phase Harmonic */}
        <path
          ref={secondaryPathRef}
          d={buildSmoothWavePath(0, 0.04, 1.35, 1.7, false)}
          fill="none"
          stroke={`url(#${gradSecondaryId})`}
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Primary Reactive Acoustic Wave */}
        <path
          ref={primaryPathRef}
          d={buildSmoothWavePath(0, 0.06, 1, 0, false)}
          fill="none"
          stroke={`url(#${gradPrimaryId})`}
          strokeWidth={isActive ? '2.6' : '1.8'}
          strokeLinecap="round"
          filter={isActive ? `url(#${glowFilterId})` : undefined}
        />
      </svg>
    </div>
  );
};
