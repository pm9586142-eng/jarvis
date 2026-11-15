import React, { useEffect, useId, useRef } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';

interface GlobalAudioVisualizerProps {
  isListening: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  reducedMotion?: boolean;
  onStop?: () => void;
}

const RIBBON_W = 800;
const RIBBON_H = 22;
const RIBBON_MID = RIBBON_H / 2;
const RIBBON_POINTS = 48;

const PILL_W = 84;
const PILL_H = 22;
const PILL_MID = PILL_H / 2;
const PILL_POINTS = 24;

function buildWavePath(
  width: number,
  midY: number,
  maxSwing: number,
  points: number,
  phase: number,
  amplitude: number,
  freqMult: number
): string {
  let d = '';
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const x = t * width;
    const envelope = Math.sin(t * Math.PI);
    const w1 = Math.sin(t * Math.PI * 4 * freqMult + phase);
    const w2 = 0.45 * Math.cos(t * Math.PI * 9 * freqMult - phase * 1.4);
    const y = midY + (w1 + w2) * 0.68 * amplitude * envelope * maxSwing;
    d += i === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

export const GlobalAudioVisualizer: React.FC<GlobalAudioVisualizerProps> = ({
  isListening,
  isSpeaking,
  audioLevel,
  reducedMotion = false,
  onStop,
}) => {
  const uid = useId().replace(/:/g, '');
  const ribbonGradId = `global-vis-ribbon-${uid}`;
  const pillGradId = `global-vis-pill-${uid}`;

  const isActive = isListening || isSpeaking;
  const levelRef = useRef(audioLevel);
  const modeRef = useRef({ isListening, isSpeaking });
  const smoothedRef = useRef(0.18);
  const phaseRef = useRef(0);

  const ribbonPrimaryRef = useRef<SVGPathElement | null>(null);
  const ribbonSecondaryRef = useRef<SVGPathElement | null>(null);
  const pillPathRef = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    levelRef.current = Math.min(1, Math.max(0, audioLevel));
  }, [audioLevel]);

  useEffect(() => {
    modeRef.current = { isListening, isSpeaking };
  }, [isListening, isSpeaking]);

  useEffect(() => {
    if (!isActive) return;

    const writePaths = (phase: number, amp: number) => {
      ribbonPrimaryRef.current?.setAttribute(
        'd',
        buildWavePath(RIBBON_W, RIBBON_MID, 9, RIBBON_POINTS, phase, amp, 1.35)
      );
      ribbonSecondaryRef.current?.setAttribute(
        'd',
        buildWavePath(RIBBON_W, RIBBON_MID, 7, RIBBON_POINTS, -phase * 0.85, amp * 0.65, 2.0)
      );
      pillPathRef.current?.setAttribute(
        'd',
        buildWavePath(PILL_W, PILL_MID, 8, PILL_POINTS, phase * 1.25, amp, 1.1)
      );
    };

    if (reducedMotion) {
      const staticAmp = Math.max(0.28, Math.min(1, audioLevel));
      writePaths(0.7, staticAmp);
      return;
    }

    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const { isListening: listening, isSpeaking: speaking } = modeRef.current;
      const raw = levelRef.current;

      // Mic input drives amplitude directly; TTS playback produces organic vocal cadence
      const target = listening
        ? Math.min(1, 0.16 + raw * 0.95)
        : speaking
          ? 0.36 + 0.24 * Math.sin(now * 0.011) + 0.12 * Math.cos(now * 0.023)
          : 0.08;

      const smoothing = target > smoothedRef.current ? 0.34 : 0.14;
      smoothedRef.current += (target - smoothedRef.current) * smoothing;

      phaseRef.current += dt * (5.8 + smoothedRef.current * 6.5);
      writePaths(phaseRef.current, smoothedRef.current);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isActive, reducedMotion, audioLevel]);

  if (!isActive) return null;

  const modeLabel = isListening ? 'LISTENING' : 'SPEAKING';
  const accentColors = isListening
    ? {
        border: 'border-cyan-400/55 bg-cyan-500/12 text-cyan-200',
        dot: 'bg-cyan-400',
        stopStart: '#22D3EE',
        stopMid: '#38BDF8',
        stopEnd: '#F43F5E',
      }
    : {
        border: 'border-violet-400/55 bg-violet-500/15 text-violet-200',
        dot: 'bg-violet-400',
        stopStart: '#A78BFA',
        stopMid: '#38BDF8',
        stopEnd: '#22D3EE',
      };

  return (
    <>
      {/* Subtle Full-Width Header Bottom-Edge SVG Waveform Overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-[1px] h-[22px] overflow-hidden opacity-85"
      >
        <svg
          viewBox={`0 0 ${RIBBON_W} ${RIBBON_H}`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id={ribbonGradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accentColors.stopStart} stopOpacity="0" />
              <stop offset="25%" stopColor={accentColors.stopMid} stopOpacity="0.85" />
              <stop offset="50%" stopColor={accentColors.stopStart} stopOpacity="1" />
              <stop offset="75%" stopColor={accentColors.stopEnd} stopOpacity="0.85" />
              <stop offset="100%" stopColor={accentColors.stopEnd} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            ref={ribbonSecondaryRef}
            d={buildWavePath(RIBBON_W, RIBBON_MID, 7, RIBBON_POINTS, 0.5, 0.25, 2.0)}
            fill="none"
            stroke={`url(#${ribbonGradId})`}
            strokeWidth="1.1"
            strokeOpacity="0.45"
          />
          <path
            ref={ribbonPrimaryRef}
            d={buildWavePath(RIBBON_W, RIBBON_MID, 9, RIBBON_POINTS, 0, 0.35, 1.35)}
            fill="none"
            stroke={`url(#${ribbonGradId})`}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Interactive Global Audio Visualizer Pill inside HeaderHud */}
      <div
        role="status"
        aria-live="polite"
        aria-label={`Global Audio Visualizer: AI ${modeLabel.toLowerCase()}`}
        className={`flex items-center gap-2 px-2.5 py-1 rounded-full border font-mono-hud text-[10px] transition-all ${accentColors.border}`}
      >
        <span className="relative flex items-center justify-center">
          <span
            className={`w-1.5 h-1.5 rounded-full ${accentColors.dot} ${
              reducedMotion ? '' : 'animate-ping absolute opacity-60'
            }`}
          />
          {isListening ? (
            <Mic className="w-3.5 h-3.5 relative text-cyan-300" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 relative text-violet-300" />
          )}
        </span>

        <span className="hidden md:inline tracking-wider font-semibold">{modeLabel}</span>

        <svg
          viewBox={`0 0 ${PILL_W} ${PILL_H}`}
          className="w-16 sm:w-20 h-4 overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={pillGradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={accentColors.stopStart} stopOpacity="0.5" />
              <stop offset="50%" stopColor={accentColors.stopMid} stopOpacity="1" />
              <stop offset="100%" stopColor={accentColors.stopEnd} stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <path
            ref={pillPathRef}
            d={buildWavePath(PILL_W, PILL_MID, 8, PILL_POINTS, 0, 0.35, 1.1)}
            fill="none"
            stroke={`url(#${pillGradId})`}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {onStop && (
          <button
            type="button"
            onClick={onStop}
            aria-label={isListening ? 'Stop voice listening' : 'Stop AI speech'}
            title={isListening ? 'Stop listening' : 'Stop speaking'}
            className="p-1 rounded-full hover:bg-white/10 text-slate-200 hover:text-rose-300 cursor-pointer transition-colors"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
          </button>
        )}
      </div>
    </>
  );
};
