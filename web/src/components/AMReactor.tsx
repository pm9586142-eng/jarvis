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

export interface AMReactorSector {
  id: string;
  label: string;
  active?: boolean;
}

interface AMReactorProps {
  state?: AMReactorState;
  audioLevel?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  hudVariant?: 'standard' | 'reference';
  statusText?: string;
  innerTopLabel?: string;
  innerBottomLabel?: string;
  subsystems?: AMReactorSubsystemArc[];
  sectors?: AMReactorSector[];
  onSectorClick?: (sectorId: string) => void;
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

const DEFAULT_REFERENCE_SECTORS: AMReactorSector[] = [
  { id: 'classic', label: 'CLSC' },
  { id: 'diagnostics', label: 'DIAG' },
  { id: 'youtube', label: 'YTBE' },
  { id: 'browser', label: 'BRWS' },
  { id: 'memory', label: 'MEM' },
  { id: 'settings', label: 'CFG' },
  { id: 'standby', label: 'STBY' },
  { id: 'notes', label: 'NOTE' },
  { id: 'tasks', label: 'TASK' },
  { id: 'research', label: 'DOCS' },
  { id: 'voice', label: 'VOX' },
  { id: 'chat', label: 'CHAT' },
];

const SIZE_MAP: Record<NonNullable<AMReactorProps['size']>, number> = {
  xs: 40,
  sm: 112,
  md: 224,
  lg: 310,
  xl: 390,
  hero: 470,
};

function getPaletteForState(state: AMReactorState) {
  switch (state) {
    case 'BOOT':
      return {
        primary: '#00E5FF',
        secondary: '#2F8BFF',
        glow: 'rgba(0, 229, 255, 0.58)',
        label: 'INITIALIZING COSMIC CORE',
        spinDurationSec: 8,
        reverseDurationSec: 5,
      };
    case 'LISTENING':
      return {
        primary: '#00E5FF',
        secondary: '#38BDF8',
        glow: 'rgba(0, 229, 255, 0.78)',
        label: 'VOICE MATRIX LISTENING',
        spinDurationSec: 10,
        reverseDurationSec: 6,
      };
    case 'THINKING':
      return {
        primary: '#2F8BFF',
        secondary: '#00E5FF',
        glow: 'rgba(47, 139, 255, 0.7)',
        label: 'NEURAL SYNTHESIS ACTIVE',
        spinDurationSec: 6,
        reverseDurationSec: 4,
      };
    case 'SPEAKING':
      return {
        primary: '#00E5FF',
        secondary: '#10B981',
        glow: 'rgba(0, 229, 255, 0.74)',
        label: 'VOCAL OUTPUT STREAM',
        spinDurationSec: 12,
        reverseDurationSec: 8,
      };
    case 'ERROR':
      return {
        primary: '#FF3D3D',
        secondary: '#FFB020',
        glow: 'rgba(255, 61, 61, 0.6)',
        label: 'DIAGNOSTIC ALERT',
        spinDurationSec: 20,
        reverseDurationSec: 14,
      };
    case 'OFFLINE':
      return {
        primary: '#38BDF8',
        secondary: '#FFB020',
        glow: 'rgba(56, 189, 248, 0.36)',
        label: 'OFFLINE STANDBY READY',
        spinDurationSec: 40,
        reverseDurationSec: 28,
      };
    case 'IDLE':
    default:
      return {
        primary: '#00E5FF',
        secondary: '#2F8BFF',
        glow: 'rgba(0, 229, 255, 0.5)',
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

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Number((cx + r * Math.cos(rad)).toFixed(2)),
    y: Number((cy + r * Math.sin(rad)).toFixed(2)),
  };
}

function buildSectorWedgePath(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  startDeg: number,
  endDeg: number
): string {
  const p1 = polarToCartesian(cx, cy, rOuter, startDeg);
  const p2 = polarToCartesian(cx, cy, rOuter, endDeg);
  const p3 = polarToCartesian(cx, cy, rInner, endDeg);
  const p4 = polarToCartesian(cx, cy, rInner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
}

export const AMReactor: React.FC<AMReactorProps> = ({
  state = 'IDLE',
  audioLevel = 0,
  size = 'lg',
  hudVariant = 'standard',
  statusText,
  innerTopLabel,
  innerBottomLabel,
  subsystems = DEFAULT_SUBSYSTEM_ARCS,
  sectors,
  onSectorClick,
  reducedMotion = false,
  powerSaving = false,
  interactive = true,
  onClick,
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const [hovered, setHovered] = useState(false);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
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
  const isReference = hudVariant === 'reference' && size !== 'xs';
  const cx = isReference ? 210 : 150;
  const cy = isReference ? 210 : 150;
  const viewBoxSize = isReference ? 420 : 300;

  const pulseScale =
    state === 'LISTENING' || state === 'SPEAKING'
      ? 1 + clampedAudio * 0.055
      : hovered
        ? 1.015
        : 1;

  // 120 outer calibration ticks + sawtooth energy spikes reacting to voice/state
  const ticks = useMemo(() => {
    const out: Array<{ x1: number; y1: number; x2: number; y2: number; major: boolean; spike: boolean }> = [];
    const rBase = isReference ? 132 : 138;
    for (let i = 0; i < 120; i++) {
      const deg = i * 3;
      const major = i % 10 === 0;
      const spike = i % 3 === 0;
      const spikeGain =
        isReference && (state === 'LISTENING' || state === 'SPEAKING')
          ? ((i % 7) + 1) * (1 + clampedAudio * 2.2)
          : major
            ? 12
            : i % 5 === 0
              ? 8
              : 4;
      const p1 = polarToCartesian(cx, cy, rBase, deg);
      const p2 = polarToCartesian(cx, cy, rBase - spikeGain, deg);
      out.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, major, spike });
    }
    return out;
  }, [isReference, cx, cy, state, clampedAudio]);

  // Reference 12 radial clickable sector pads between r=146 and r=178
  const sectorItems = useMemo(() => {
    if (!isReference) return [];
    const list = (sectors && sectors.length > 0 ? sectors : DEFAULT_REFERENCE_SECTORS).slice(0, 12);
    const step = 360 / list.length;
    const gap = 3.2;
    return list.map((sec, idx) => {
      const startDeg = -105 + idx * step + gap / 2;
      const endDeg = -105 + (idx + 1) * step - gap / 2;
      const midDeg = (startDeg + endDeg) / 2;
      const labelPos = polarToCartesian(cx, cy, 162, midDeg);
      return {
        ...sec,
        d: buildSectorWedgePath(cx, cy, 145, 179, startDeg, endDeg),
        lx: labelPos.x,
        ly: labelPos.y,
      };
    });
  }, [isReference, sectors, cx, cy]);

  // 5 segmented holographic subsystem arcs
  const arcSegments = useMemo(() => {
    const list = (subsystems.length > 0 ? subsystems : DEFAULT_SUBSYSTEM_ARCS).slice(0, 5);
    const total = list.length;
    const spanDeg = 360 / total;
    const gapDeg = 10;
    const r = isReference ? 102 : 104;

    return list.map((item, idx) => {
      const startDeg = idx * spanDeg - 90 + gapDeg / 2;
      const endDeg = (idx + 1) * spanDeg - 90 - gapDeg / 2;
      const p1 = polarToCartesian(cx, cy, r, startDeg);
      const p2 = polarToCartesian(cx, cy, r, endDeg);
      const largeArc = endDeg - startDeg > 180 ? 1 : 0;
      return {
        ...item,
        d: `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
        color: getArcColor(item.status),
      };
    });
  }, [subsystems, isReference, cx, cy]);

  const showDetails = size !== 'xs';
  const showFooterLabel =
    !isReference && (size === 'md' || size === 'lg' || size === 'xl' || size === 'hero');

  const coreFontSize =
    size === 'xs'
      ? 'text-[10px]'
      : size === 'sm'
        ? 'text-lg'
        : size === 'md'
          ? 'text-2xl'
          : size === 'lg'
            ? 'text-3xl sm:text-4xl'
            : 'text-4xl sm:text-5xl';

  const coreRadius = isReference ? 58 : 60;

  return (
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
          filter: `drop-shadow(0 0 ${size === 'xs' ? 8 : isReference ? 28 : 22}px ${palette.glow})`,
        }}
      >
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`AM Cosmic Reactor — ${statusText || palette.label}`}
        >
          <defs>
            <radialGradient id={`amCoreBg-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.primary} stopOpacity="0.42" />
              <stop offset="56%" stopColor="#07162E" stopOpacity="0.92" />
              <stop offset="100%" stopColor="#01040A" stopOpacity="0.98" />
            </radialGradient>
            <radialGradient id={`amAura-${uid}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={palette.primary} stopOpacity="0.44" />
              <stop offset="60%" stopColor={palette.secondary} stopOpacity="0.16" />
              <stop offset="100%" stopColor={palette.primary} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Outer atmospheric cosmic glow */}
          <circle cx={cx} cy={cy} r={isReference ? 206 : 146} fill={`url(#amAura-${uid})`} />

          {/* REFERENCE OUTER GUNMETAL CHASSIS & 45-DEG TACTICAL CALIPERS */}
          {isReference && (
            <g>
              <circle
                cx={cx}
                cy={cy}
                r="198"
                fill="none"
                stroke="#0F2036"
                strokeWidth="10"
              />
              <circle
                cx={cx}
                cy={cy}
                r="192"
                fill="none"
                stroke={palette.primary}
                strokeOpacity="0.42"
                strokeWidth="1.4"
                strokeDasharray="48 16 14 16"
              />
              <circle
                cx={cx}
                cy={cy}
                r="204"
                fill="none"
                stroke={palette.secondary}
                strokeOpacity="0.28"
                strokeWidth="1"
              />
              {/* 4 diagonal corner brackets + alignment bolts */}
              {[45, 135, 225, 315].map((deg) => {
                const pA = polarToCartesian(cx, cy, 184, deg);
                const pB = polarToCartesian(cx, cy, 208, deg);
                return (
                  <g key={deg}>
                    <line
                      x1={pA.x}
                      y1={pA.y}
                      x2={pB.x}
                      y2={pB.y}
                      stroke={palette.primary}
                      strokeOpacity="0.72"
                      strokeWidth="2.2"
                    />
                    <circle cx={pB.x} cy={pB.y} r="3" fill={palette.primary} />
                  </g>
                );
              })}

              {/* 12 Interactive Segmented Radial Orbital Sector Buttons */}
              {sectorItems.map((sec) => {
                const isHover = hoveredSector === sec.id;
                const isActive = Boolean(sec.active);
                return (
                  <g
                    key={sec.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSectorClick?.(sec.id);
                    }}
                    onMouseEnter={() => setHoveredSector(sec.id)}
                    onMouseLeave={() => setHoveredSector(null)}
                    className={onSectorClick ? 'cursor-pointer' : undefined}
                  >
                    <path
                      d={sec.d}
                      fill={
                        isActive
                          ? 'rgba(0, 229, 255, 0.24)'
                          : isHover
                            ? 'rgba(0, 229, 255, 0.16)'
                            : 'rgba(8, 20, 38, 0.88)'
                      }
                      stroke={isActive || isHover ? '#00E5FF' : 'rgba(56, 189, 248, 0.36)'}
                      strokeWidth={isActive || isHover ? 1.6 : 1}
                    />
                    <text
                      x={sec.lx}
                      y={sec.ly + 3}
                      textAnchor="middle"
                      fill={isActive || isHover ? '#E0F9FF' : '#93C5FD'}
                      fontSize="8.5"
                      fontWeight="700"
                      fontFamily="Share Tech Mono, monospace"
                      letterSpacing="0.08em"
                    >
                      {sec.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Rotating outer calibration tick & sawtooth crown */}
          {showDetails && (
            <g
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: animationsDisabled
                  ? 'none'
                  : `am-spin-slow ${palette.spinDurationSec}s linear infinite`,
              }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isReference ? 136 : 140}
                fill="none"
                stroke={palette.primary}
                strokeOpacity="0.34"
                strokeWidth="1.2"
              />
              {ticks.map((t, idx) => (
                <line
                  key={idx}
                  x1={t.x1}
                  y1={t.y1}
                  x2={t.x2}
                  y2={t.y2}
                  stroke={t.major || t.spike ? palette.primary : palette.secondary}
                  strokeOpacity={t.major ? 0.92 : t.spike ? 0.6 : 0.32}
                  strokeWidth={t.major ? 2 : 1}
                />
              ))}
            </g>
          )}

          {/* Counter-rotating segmented geometric mechanical ring */}
          <g
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              animation: animationsDisabled
                ? 'none'
                : `am-spin-reverse ${palette.reverseDurationSec}s linear infinite`,
            }}
          >
            <circle
              cx={cx}
              cy={cy}
              r={isReference ? 116 : 118}
              fill="none"
              stroke={palette.primary}
              strokeOpacity="0.72"
              strokeWidth="2.8"
              strokeDasharray="34 10 10 10"
            />
            {showDetails && (
              <>
                <circle cx={cx} cy={cy - (isReference ? 116 : 118)} r="3.2" fill={palette.primary} />
                <circle cx={cx} cy={cy + (isReference ? 116 : 118)} r="3.2" fill={palette.primary} />
                <circle cx={cx - (isReference ? 116 : 118)} cy={cy} r="2.6" fill={palette.secondary} />
                <circle cx={cx + (isReference ? 116 : 118)} cy={cy} r="2.6" fill={palette.secondary} />
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
                strokeWidth="5"
                strokeLinecap="round"
                strokeOpacity={state === 'OFFLINE' ? 0.45 : 0.9}
              >
                <title>{`${seg.label}: ${seg.status.toUpperCase()}`}</title>
              </path>
            ))}

          {/* Inner Hexagonal / Geometric Energy Lattice */}
          <g
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              animation: animationsDisabled
                ? 'none'
                : `am-spin-slow ${Math.round(palette.spinDurationSec * 0.75)}s linear infinite`,
            }}
          >
            <polygon
              points={
                isReference
                  ? `${cx},${cy - 88} ${cx + 76},${cy - 44} ${cx + 76},${cy + 44} ${cx},${cy + 88} ${cx - 76},${cy + 44} ${cx - 76},${cy - 44}`
                  : '150,62 226,106 226,194 150,238 74,194 74,106'
              }
              fill="none"
              stroke={palette.primary}
              strokeOpacity="0.48"
              strokeWidth="1.4"
            />
            {showDetails && (
              <circle
                cx={cx}
                cy={cy}
                r={isReference ? 78 : 76}
                fill="none"
                stroke={palette.secondary}
                strokeOpacity="0.4"
                strokeWidth="1.2"
                strokeDasharray="6 5"
              />
            )}
          </g>

          {/* Orbiting energy particles */}
          {showDetails && !animationsDisabled && (
            <g
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `am-spin-reverse ${Math.max(4, palette.reverseDurationSec - 1)}s linear infinite`,
              }}
            >
              <circle cx={cx} cy={cy - (isReference ? 92 : 90)} r="3.2" fill="#00E5FF" opacity="0.95" />
              <circle cx={cx + 78} cy={cy + 46} r="2.6" fill="#2F8BFF" opacity="0.88" />
              <circle cx={cx - 78} cy={cy + 46} r="2.4" fill="#7DEEFF" opacity="0.82" />
            </g>
          )}

          {/* Reference inner micro time/date arc captions */}
          {isReference && innerTopLabel && (
            <text
              x={cx}
              y={cy - 86}
              textAnchor="middle"
              fill="#7DEEFF"
              fontSize="9"
              fontFamily="Share Tech Mono, monospace"
              letterSpacing="0.18em"
            >
              {innerTopLabel}
            </text>
          )}
          {isReference && innerBottomLabel && (
            <text
              x={cx}
              y={cy + 94}
              textAnchor="middle"
              fill="#7DEEFF"
              fontSize="9"
              fontFamily="Share Tech Mono, monospace"
              letterSpacing="0.18em"
            >
              {innerBottomLabel}
            </text>
          )}

          {/* Bright Central AM Reactor Core Medallion */}
          <circle
            cx={cx}
            cy={cy}
            r={coreRadius}
            fill={`url(#amCoreBg-${uid})`}
            stroke={palette.primary}
            strokeWidth={size === 'xs' ? 3 : 2.8}
            strokeOpacity="0.96"
          />
          <circle
            cx={cx}
            cy={cy}
            r={coreRadius - 8}
            fill="none"
            stroke={palette.secondary}
            strokeOpacity="0.55"
            strokeWidth="1.2"
            strokeDasharray="5 4"
          />
        </svg>

        {/* Central Clickable Core Hit Area -> Exact Central Identity: "AM" */}
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-label={`AM Core Reactor (${state}) — Click to interact`}
            className="absolute w-[34%] h-[34%] rounded-full flex flex-col items-center justify-center text-center bg-transparent border-0 cursor-pointer focus-visible:outline-none hover:scale-105 transition-transform"
          >
            <span
              data-testid="am-reactor-core-text"
              className={`font-display font-black tracking-[0.2em] leading-none text-cyan-50 drop-shadow-[0_0_20px_rgba(0,229,255,0.95)] ${coreFontSize}`}
            >
              AM
            </span>
          </button>
        ) : (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span
              data-testid="am-reactor-core-text"
              className={`font-display font-black tracking-[0.2em] leading-none text-cyan-50 drop-shadow-[0_0_20px_rgba(0,229,255,0.95)] ${coreFontSize}`}
            >
              AM
            </span>
          </div>
        )}
      </div>

      {showFooterLabel && (
        <div className="mt-2 flex items-center gap-2 px-3 py-1 rounded-full bg-[#071326]/85 border border-cyan-400/30">
          <span
            className={`w-2 h-2 rounded-full ${
              state === 'ERROR'
                ? 'bg-[#FF3D3D]'
                : state === 'OFFLINE'
                  ? 'bg-[#38BDF8]'
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
};
