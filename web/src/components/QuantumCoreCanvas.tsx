import React, { useEffect, useRef } from 'react';

interface QuantumCoreCanvasProps {
  audioPulse?: number; // 0 to 1
  nodeCount?: number;
  reducedMotion?: boolean;
  showCoreLabel?: boolean;
  className?: string;
}

export const QuantumCoreCanvas: React.FC<QuantumCoreCanvasProps> = ({
  audioPulse = 0,
  nodeCount = 52,
  reducedMotion = false,
  showCoreLabel = false,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pulseRef = useRef(audioPulse);
  const tiltRef = useRef({ pitch: 0, yaw: 0, dragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    pulseRef.current = audioPulse;
  }, [audioPulse]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Seeded quantum nodes
    const particles = Array.from({ length: nodeCount }, (_, i) => ({
      angle: (i / nodeCount) * Math.PI * 2 + (i % 3) * 0.4,
      radiusScale: 0.36 + ((i * 37) % 64) / 100,
      ring: i % 3,
    }));

    let animId = 0;
    const startTime = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = parent.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    const drawFrame = (now: number) => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 300;
      const h = parent ? parent.clientHeight : 300;
      const cx = w / 2;
      const cy = h / 2;

      const t = reducedMotion ? 0 : (now - startTime) / 1000;
      const audio = pulseRef.current;
      const { pitch, yaw } = tiltRef.current;
      const flareBreath = 0.96 + 0.08 * Math.sin(t * 2.2);
      const maxR = Math.min(w, h) * 0.42 * (flareBreath + audio * 0.22);

      ctx.clearRect(0, 0, w, h);

      // 1. Ambient Nebula & Core Magnetic Bloom
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, maxR * 1.45);
      grad.addColorStop(0, `rgba(125, 211, 252, ${0.35 + audio * 0.25})`);
      grad.addColorStop(0.45, 'rgba(0, 153, 255, 0.16)');
      grad.addColorStop(0.75, 'rgba(124, 58, 237, 0.08)');
      grad.addColorStop(1, 'rgba(2, 4, 10, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 1.45, 0, Math.PI * 2);
      ctx.fill();

      const r1Rot = t * 0.52;
      const r2Rot = -t * 0.78;
      const r3Rot = t * 0.39;

      // 2. Gyroscopic Orbital Ring 1 (Outer Caliper)
      const r1 = maxR * 0.95;
      const r1Y = r1 * (0.42 + pitch * 0.25);
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.48)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r1, Math.max(8, r1Y), yaw * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + r1Rot;
        const nx = cx + r1 * Math.cos(ang);
        const ny = cy + r1Y * Math.sin(ang);
        ctx.fillStyle = '#7DD3FC';
        ctx.beginPath();
        ctx.arc(nx, ny, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Gyroscopic Orbital Ring 2 (Counter-rotating tilted ring)
      const r2 = maxR * 0.72;
      const r2Y = r2 * (0.68 - pitch * 0.2);
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r2, Math.max(8, r2Y), -0.35 + yaw * 0.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 4. Gyroscopic Orbital Ring 3 (Inner High-Energy Conductor)
      const r3 = maxR * 0.48;
      const r3Y = r3 * (0.82 + yaw * 0.15);
      ctx.save();
      ctx.strokeStyle = `rgba(125, 211, 252, ${0.68 + audio * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r3, Math.max(8, r3Y), 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 5. Coronal Energy Flares
      const flareCount = 12;
      for (let k = 0; k < flareCount; k++) {
        const fAng = (k / flareCount) * Math.PI * 2 + r2Rot;
        const fLen = maxR * 0.82 * (0.72 + 0.3 * Math.sin(fAng * 3 + r1Rot) + audio * 0.4);
        const ex = cx + fLen * Math.cos(fAng);
        const ey = cy + fLen * Math.sin(fAng) * 0.85;
        const lineGrad = ctx.createLinearGradient(cx, cy, ex, ey);
        lineGrad.addColorStop(0, `rgba(255, 255, 255, ${0.85 + audio * 0.15})`);
        lineGrad.addColorStop(0.45, `rgba(0, 240, 255, ${0.45 + audio * 0.3})`);
        lineGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1.6 + audio * 1.8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }

      // 6. Floating Quantum Nodes & Synaptic Filaments
      const projected: Array<{ x: number; y: number; ring: number }> = [];
      for (const p of particles) {
        const rot = p.ring === 0 ? r1Rot : p.ring === 1 ? r2Rot : r3Rot;
        const ang = p.angle + rot + yaw;
        const rad = maxR * p.radiusScale;
        const px = cx + rad * Math.cos(ang);
        const py = cy + rad * Math.sin(ang) * (0.55 + pitch * 0.2);
        projected.push({ x: px, y: py, ring: p.ring });

        ctx.fillStyle = p.ring === 0 ? '#FFFFFF' : p.ring === 1 ? '#7DD3FC' : '#38BDF8';
        ctx.beginPath();
        ctx.arc(px, py, 1.8 + audio * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < projected.length - 1; i += 2) {
        const a = projected[i];
        const b = projected[i + 1];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        if (dx * dx + dy * dy < maxR * maxR * 0.26) {
          ctx.strokeStyle = `rgba(0, 240, 255, ${0.42 + audio * 0.3})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // 7. Central Quantum Singularity Core
      const coreR = (showCoreLabel ? 36 : 24) + audio * 26;
      const coreGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreR);
      coreGrad.addColorStop(0, showCoreLabel ? 'rgba(4, 12, 26, 0.85)' : '#FFFFFF');
      coreGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.68)');
      coreGrad.addColorStop(0.78, 'rgba(0, 240, 255, 0.35)');
      coreGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      if (!reducedMotion) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    animId = requestAnimationFrame(drawFrame);
    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [nodeCount, reducedMotion, showCoreLabel]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <canvas
        ref={canvasRef}
        aria-label="AM AI Quantum Neural Core visualization"
        className="w-full h-full touch-none select-none cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          tiltRef.current.dragging = true;
          tiltRef.current.lastX = e.clientX;
          tiltRef.current.lastY = e.clientY;
        }}
        onPointerMove={(e) => {
          if (!tiltRef.current.dragging) {
            const rect = e.currentTarget.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width - 0.5;
            const ny = (e.clientY - rect.top) / rect.height - 0.5;
            tiltRef.current.yaw = nx * 0.35;
            tiltRef.current.pitch = ny * 0.35;
            return;
          }
          const dx = e.clientX - tiltRef.current.lastX;
          const dy = e.clientY - tiltRef.current.lastY;
          tiltRef.current.lastX = e.clientX;
          tiltRef.current.lastY = e.clientY;
          tiltRef.current.yaw = Math.max(-0.8, Math.min(0.8, tiltRef.current.yaw + dx * 0.006));
          tiltRef.current.pitch = Math.max(-0.6, Math.min(0.6, tiltRef.current.pitch + dy * 0.006));
        }}
        onPointerUp={() => {
          tiltRef.current.dragging = false;
        }}
        onPointerLeave={() => {
          tiltRef.current.dragging = false;
        }}
      />
      {showCoreLabel && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="px-4 py-2 rounded-full bg-[#020714]/70 border border-cyan-400/50 shadow-[0_0_28px_rgba(0,240,255,0.45)] backdrop-blur-sm">
            <p className="font-display text-lg sm:text-xl font-bold tracking-[0.28em] text-cyan-200 drop-shadow-[0_0_12px_rgba(0,240,255,0.9)]">
              AM AI
            </p>
            <p className="font-mono-hud text-[9px] tracking-[0.3em] text-sky-300 mt-0.5">
              COSMIC CORE
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
