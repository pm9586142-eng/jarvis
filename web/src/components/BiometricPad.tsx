import React, { useEffect, useRef, useState } from 'react';
import { Fingerprint } from 'lucide-react';

interface BiometricPadProps {
  onVerified: () => void;
}

export const BiometricPad: React.FC<BiometricPadProps> = ({ onVerified }) => {
  const [holding, setHolding] = useState(false);
  const [verified, setVerified] = useState(false);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (verified) return;

    if (!holding) {
      setProgress(0);
      return;
    }

    const start = performance.now();
    const durationMs = 1100;

    const tick = (now: number) => {
      const ratio = Math.min(1, (now - start) / durationMs);
      setProgress(ratio);
      if (ratio >= 1) {
        setVerified(true);
        setHolding(false);
        onVerified();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [holding, verified, onVerified]);

  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        aria-label="Touch and hold biometric scanner to initialize JARVIS"
        onPointerDown={() => !verified && setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !verified) {
            e.preventDefault();
            setVerified(true);
            setProgress(1);
            onVerified();
          }
        }}
        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all select-none touch-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
          verified
            ? 'bg-emerald-500/15 border-2 border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.45)]'
            : holding
              ? 'bg-cyan-400/15 border-2 border-cyan-300 shadow-[0_0_28px_rgba(0,240,255,0.45)] scale-95'
              : 'bg-[#0D1527] border-2 border-cyan-500/40 hover:border-cyan-400'
        }`}
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="rgba(30, 41, 59, 0.8)"
            strokeWidth="3.5"
          />
          {progress > 0 && (
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={verified ? '#10B981' : '#00F0FF'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          )}
        </svg>

        <Fingerprint
          className={`w-12 h-12 transition-colors ${
            verified ? 'text-emerald-400' : holding ? 'text-cyan-300' : 'text-cyan-400/80'
          }`}
        />

        {holding && !verified && (
          <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-pulse" />
        )}
      </button>

      <p
        className={`font-mono-hud text-[11px] tracking-widest uppercase text-center ${
          verified ? 'text-emerald-400' : holding ? 'text-cyan-300' : 'text-slate-400'
        }`}
      >
        {verified
          ? 'BIOMETRIC MATCH: TONY STARK [LEVEL 5]'
          : holding
            ? `QUANTUM CALIBRATION: ${Math.round(progress * 100)}%`
            : 'HOLD SENSOR (OR CLICK ENTER) TO INITIALIZE'}
      </p>
    </div>
  );
};
