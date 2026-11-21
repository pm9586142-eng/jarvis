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
      return;
    }

    const start = performance.now();
    const durationMs = 900;

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

  const releaseHold = () => {
    setHolding(false);
    if (!verified) setProgress(0);
  };

  const circumference = 2 * Math.PI * 44;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-2.5">
      <button
        type="button"
        data-testid="biometric-pad-btn"
        aria-label="Touch and hold biometric scanner to initialize AM AI"
        onPointerDown={() => !verified && setHolding(true)}
        onPointerUp={releaseHold}
        onPointerLeave={releaseHold}
        onPointerCancel={releaseHold}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !verified) {
            e.preventDefault();
            setVerified(true);
            setProgress(1);
            onVerified();
          }
        }}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all select-none touch-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400 ${
          verified
            ? 'bg-emerald-500/15 border-2 border-emerald-400 shadow-[0_0_28px_rgba(16,185,129,0.45)]'
            : holding
              ? 'bg-cyan-400/15 border-2 border-cyan-300 shadow-[0_0_28px_rgba(0,229,255,0.45)] scale-95'
              : 'bg-[#071326] border-2 border-cyan-500/40 hover:border-cyan-400'
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
              stroke={verified ? '#10B981' : '#00E5FF'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          )}
        </svg>

        <Fingerprint
          className={`w-10 h-10 transition-colors ${
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
          ? 'OPERATOR SIGNATURE VERIFIED'
          : holding
            ? `CORE CALIBRATION: ${Math.round(progress * 100)}%`
            : 'HOLD BIOMETRIC SENSOR TO AUTHORIZE'}
      </p>
    </div>
  );
};
