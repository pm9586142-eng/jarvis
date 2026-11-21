import React, { useEffect, useId, useMemo, useState } from 'react';

export type AMReactorState =
  | 'BOOT'
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'ERROR'
  | 'OFFLINE';

export type AMSubsystemArcStatus = 'online' | 'degraded' | 'offline' | 'unknown';

export interface AMReactorSubsystemArc {
  id: string;
  label: string;
  status: AMSubsystemArcStatus;
}

interface AMReactorProps {
  state?: AMReactorState;
  audioLevel?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  statusText?: string;
  subsystems?: AMReactorSubsystemArc[];
  reducedMotion?: boolean;
  powerSaving?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  className?: string;
}

const DEFAULT_SUBSYSTEM_ARCS: AMReactorSubsystemArc[] = [
  { id: 'core', label: 'CORE', status: 'online' },
  { id: 'ai', label: 'AI', status: 'online' },
  { id: 'voice', label: 'VOICE', status: 'online' },
  { id: 'memory', label: 'MEMORY', status: 'online' },
  { id: 'media', label: 'MEDIA', status: 'online' },
];

const SIZE_MAP: Record<NonNullable<AMReactorProps['size']>, number> = {
  xs: 44,
  sm: 112,
  md: 220,
  lg: 296,
  xl: 360,
};

function getPaletteForState(state: AMReactorState) {
  switch (state) {
    case 'BOOT':
      return {
        primary: '#00E5FF',
        secondary: '#2F8BFF',
        glow: 'rgba(0, 229, 255, 0.55)',
        label: 'INITIALIZING COSMIC CORE',
        spinDurationSec: 8,
        reverseDurationSec: 5,
      };
    case 'LISTENING':
      return {
        primary: '#00E5FF',
        secondary: '#38BDF8',
        glow: 'rgba(0, 229, 255, 0.72)',
        label: 'VOICE MATRIX LISTENING',
        spinDurationSec: 10,
        reverseDurationSec: 6,
      };
    case 'THINKING':
      return {
        primary: '#2F8BFF',
        secondary: '#7C3AED',
        glow: 'rgba(47, 139, 255, 0.65)',
        label: 'NEURAL SYNTHESIS ACTIVE',
        spinDurationSec: 6,
        reverseDurationSec: 4,
      };
    case 'SPEAKING':
      return {
        primary: '#00E5FF',
        secondary: '#10B981',
        glow: 'rgba(0, 229, 255, 0.7)',
        label: 'VOCAL OUTPUT STREAM',
        spinDurationSec: 12,
        reverseDurationSec: 8,
      };
    case 'ERROR':
      return {
        primary: '#FF3D3D',
        secondary: '#FFB020',
        glow: 'rgba(255, 61, 61, 0.58)',
        label: 'DIAGNOSTIC ALERT',
        spinDurationSec: 20,
        reverseDurationSec: 14,
      };
    case 'OFFLINE':
      return {
        primary: '#64748B',
        secondary: '#FFB020',
        glow: 'rgba(100, 116, 139, 0.35)',
        label: 'STANDBY / OFFLINE',
        spinDurationSec: 42,
        reverseDurationSec: 32,
      };
    case 'IDLE':
    default:
      return {
        primary: '#00E5FF',
        secondary: '#2F8BFF',
        glow: 'rgba(0, 229, 255, 0.42)',
        label: 'AM CORE NOMINAL',
        spinDurationSec: 26,
        reverseDurationSec: 18,
      };
  }
}

function getArcColor(status: AMSubsystemArcStatus): string {
  switch (status) {
    case 'online':
      return '#00E5FF';
    case 'degraded':
      return '#FFB020';
    case 'offline':
      return '#FF3D3D';
    case 'unknown':
    default:
      return '#64748B';
  }
}

export const AMReactor: React.FC<AMReactorProps> = ({
  state = 'IDLE',
  audioLevel = 0,
  size = 'lg',
  statusText,
  subsystems = DEFAULT_SUBSYSTEM_ARCS,
  reducedMotion = false,
  powerSaving = false,
  interactive = true,
  onClick,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibilityChange = () => setTabHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const animationsDisabled = reducedMotion || powerSaving || tabHidden;
  const px = SIZE_MAP[size];
  const palette = getPaletteForState(state);
  const clampedAudio = Math.max(0, Math.min(1, audioLevel));
  const pulseScale =
    state === 'LISTENING' || state === 'SPEAKING'
      ? 1 + clampedAudio * 0.065
      : hovered
        ? 1.02
        : 1;

  // 120 outer telemetry calibration ticks (svg geometry memoized once)
  const ticks = useMemo(() => {
    const out: Array<{ x1: number; y1: number; x2: number; y2: number; major: boolean }> = [];
    for (let i = 0; i < 120; i++) {
      const deg = i * 3;
      const rad = (deg * Math.PI) / 180;
      const major = i % 10 === 0;
      const rOuter = 138;
      const rInner = major ? 126 : i % 5 === 0 ? 130 : 133;
      out.push({
        x1: Number((150 + rOuter * Math.cos(rad)).toFixed(2)),
        y1: Number((150 + rOuter * Math.sin(rad)).toFixed(2)),
        x2: Number((150 + rInner * Math.cos(rad)).toFixed(2)),
        y2: Number((150 + rInner * Math.sin(rad)).toFixed(2)),
        major,
      });
    }
    return out;
  }, []);

  // 5 segmented holographic subsystem arcs
  const arcSegments = useMemo(() => {
    const list = (subsystems.length > 0 ? subsystems : DEFAULT_SUBSYSTEM_ARCS).slice(0, 5);
    const total = list.length;
    const spanDeg = 360 / total;
    const gapDeg = 10;
    const r = 104;

    return list.map((item, idx) => {
      const startDeg = idx * spanDeg - 90 + gapDeg / 2;
      const endDeg = (idx + 1) * spanDeg - 90 - gapDeg / 2;
      const sRad = (startDeg * Math.PI) / 180;
      const eRad = (endDeg * Math.PI) / 180;
      const x1 = Number((150 + r * Math.cos(sRad)).toFixed(2));
      const y1 = Number((150 + r * Math.sin(sRad)).toFixed(2));
      const x2 = Number((150 + r * Math.cos(eRad)).toFixed(2));
      const y2 = Number((150 + r * Math.sin(eRad)).toFixed(2));
      const largeArc = endDeg - startDeg > 180 ? 1 : 0;
      return {
        ...item,
        d: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        color: getArcColor(item.status),
      };
    });
  }, [subsystems]);

  const showDetails = size !== 'xs';
  const showFooterLabel = size === 'md' || size === 'lg' || size === 'xl';

  const coreFontSize =
    size === 'xs'
      ? 'text-[11px]'
      : size === 'sm'
        ? 'text-lg'
        : size === 'md'
          ? 'text-2xl'
          : size === 'lg'
            ? 'text-3xl sm:text-4xl'
            : 'text-4xl sm:text-5xl';

  const container = (
    <div
      className={`relative inline-flex flex-col items-center justify-center select-none ${className}`}
      style={{ width: px, maxWidth: '100%' }}
      onMouseEnter={() => interactive && setHovered(true)}
      onMouseLeave={() => interactive && setHovered(false)}
    >
      <div
        className="relative flex items-center justify-center w-full aspect-square transition-transform duration-200"
        style={{
          transform: `scale(${pulseScale})`,
          filter: `drop-shadow(0 0 ${size === 'xs' ? 8 : 22}px ${palette.glow})`,
        }}
      >
        <svg
          viewBox="0 0 300 300"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`AM Cosmic Reactor — ${statusText || palette.label}`}
        >
          <defs>
            <radialGradient id={`amCoreBg-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.primary} stopOpacity="0.34" />
              <stop offset="52%" stopColor="#071326" stopOpacity="0.88" />
              <stop offset="100%" stopColor="#02050B" stopOpacity="0.96" />
            </radialGradient>
            <radialGradient id={`amAura-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.primary} stopOpacity="0.38" />
              <stop offset="65%" stopColor={palette.secondary} stopOpacity="0.12" />
              <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer atmospheric cosmic halo */}
          <circle cx="150" cy="150" r="146" fill={`url(#amAura-${uid})`} />

          {/* Rotating 120-tick precision calibration ring */}
          {showDetails && (
            <g
              style={{
                transformOrigin: '150px 150px',
                animation: animationsDisabled
                  ? 'none'
                  : `am-spin-slow ${palette.spinDurationSec}s linear infinite`,
              }}
            >
              <circle
                cx="150"
                cy="150"
                r="140"
                fill="none"
                stroke={palette.primary}
                strokeOpacity="0.24"
                strokeWidth="1"
              />
              {ticks.map((t, idx) => (
                <line
                  key={idx}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={t.major ? palette.primary : palette.secondary}
                  strokeOpacity={t.major ? 0.85 : 0.35}
                  strokeWidth={t.major ? 1.8 : 0.9}
                />
              ))}
            </g>
          )}

          {/* Counter-rotating segmented geometric ring */}
          <g
            style={{
              transformOrigin: '150px 150px',
              animation: animationsDisabled
                ? 'none'
                : `am-spin-reverse ${palette.reverseDurationSec}s linear infinite`,
            }}
          >
            <circle
              cx="150"
              cy="150"
              r="118"
              fill="none"
              stroke={palette.secondary}
              strokeOpacity="0.55"
              strokeWidth="2"
              strokeDasharray="28 12 8 12"
            />
            {showDetails && (
              <>
                <circle cx="150" cy="32" r="3" fill={palette.primary} />
                <circle cx="150" cy="268" r="3" fill={palette.primary} />
                <circle cx="32" cy="150" r="2.5" fill={palette.secondary} />
                <circle cx="268" cy="150" r="2.5" fill={palette.secondary} />
              </>
            )}
          </g>

          {/* 5 Subsystem Holographic Arcs */}
          {showDetails &&
            arcSegments.map((seg) => (
              <path
                key={seg.id}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeOpacity={state === 'OFFLINE' ? 0.45 : 0.88}
              >
                <title>{`${seg.label}: ${seg.status.toUpperCase()}`}</title>
              </path>
            ))}

          {/* Inner Hexagonal Energy Lattice */}
          <g
            style={{
              transformOrigin: '150px 150px',
              animation: animationsDisabled
                ? 'none'
                : `am-spin-slow ${Math.round(palette.spinDurationSec * 0.75)}s linear infinite`,
            }}
          >
            <polygon
              points="150,62 226,106 226,194 150,238 74,194 74,106"
              fill="none"
              stroke={palette.primary}
              strokeOpacity="0.42"
              strokeWidth="1.4"
            />
            {showDetails && (
              <polygon
                points="150,74 216,112 216,188 150,226 84,188 84,112"
                fill="none"
                stroke={palette.secondary}
                strokeOpacity="0.28"
                strokeWidth="1"
                strokeDasharray="6 4"
              />
            )}
          </g>

          {/* Subtle orbiting cosmic particles (auto-paused when reducedMotion or powerSaving) */}
          {showDetails && !animationsDisabled && (
            <g
              style={{
                transformOrigin: '150px 150px',
                animation: `am-spin-reverse ${Math.max(4, palette.reverseDurationSec - 1)}s linear infinite`,
              }}
            >
              <circle cx="150" cy="60" r="3" fill="#00E5FF" opacity="0.9" />
              <circle cx="228" cy="195" r="2.5" fill="#2F8BFF" opacity="0.85" />
              <circle cx="72" cy="195" r="2.2" fill="#7DEEFF" opacity="0.8" />
            </g>
          )}

          {/* Central AM Reactor Core Medallion */}
          <circle
            cx="150"
            cy="150"
            r="60"
            fill={`url(#amCoreBg-${uid})`}
            stroke={palette.primary}
            strokeWidth={size === 'xs' ? 3 : 2.2}
            strokeOpacity="0.92"
          />
          <circle
            cx="150"
            cy="150"
            r="52"
            fill="none"
            stroke={palette.secondary}
            strokeOpacity="0.45"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>

        {/* Guaranteed Exact Central Identity: "AM" */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            data-testid="am-reactor-core-text"
            className={`font-display font-black tracking-[0.2em] leading-none text-cyan-100 drop-shadow-[0_0_16px_rgba(0,229,255,0.85)] ${coreFontSize}`}
          >
            AM
          </span>
        </div>
      </div>

      {showFooterLabel && (
        <div className="mt-2 flex items-center gap-2 px-3 py-1 rounded-full bg-[#071326]/85 border border-cyan-400/30">
          <span
            className={`w-2 h-2 rounded-full ${
              state === 'ERROR' || state === 'OFFLINE'
                ? 'bg-[#FF3D3D]'
                : state === 'BOOT' || state === 'THINKING'
                  ? 'bg-[#FFB020]'
                  : 'bg-[#00E5FF]'
            } ${!animationsDisabled && state !== 'OFFLINE' ? 'animate-pulse' : ''}`}
          />
          <span className="font-mono-hud text-[10px] tracking-[0.18em] text-cyan-200 uppercase">
            {statusText || palette.label}
          </span>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`AM Core Reactor (${state}) — Click to interact`}
        className="group cursor-pointer bg-transparent border-0 p-0 focus-visible:outline-none rounded-full"
      >
        {container}
      </button>
    );
  }

  return container;
};
