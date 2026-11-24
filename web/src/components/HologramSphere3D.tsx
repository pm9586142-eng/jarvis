import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RotateCcw } from 'lucide-react';
import { useSharedAiState } from '../context/SharedAiStateContext';
import { SharedAiState } from '../types/jarvis';

interface HologramSphere3DProps {
  size?: 'sm' | 'md' | 'hero';
  interactive?: boolean;
  powerSaving?: boolean;
  onClick?: () => void;
  centerTopLabel?: string;
  centerBottomLabel?: string;
  className?: string;
}

function createDeterministicParticles(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const y = 1 - 2 * t;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const shell = 1.42 + ((i * 19) % 100) / 170;
    positions[i * 3] = Math.cos(theta) * radiusAtY * shell;
    positions[i * 3 + 1] = y * shell;
    positions[i * 3 + 2] = Math.sin(theta) * radiusAtY * shell;
  }
  return positions;
}

function getStateSpeedMultiplier(state: SharedAiState): number {
  switch (state) {
    case 'speaking':
      return 1.85;
    case 'thinking':
      return 2.4;
    case 'listening':
      return 1.45;
    case 'idle':
    default:
      return 0.68;
  }
}

export const HologramSphere3D: React.FC<HologramSphere3DProps> = ({
  size = 'hero',
  interactive = true,
  powerSaving = false,
  onClick,
  centerTopLabel,
  centerBottomLabel,
  className = '',
}) => {
  const {
    aiState,
    stateLabel,
    audioLevel,
    reducedMotion,
    themePreset,
  } = useSharedAiState();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);

  const stateRef = useRef<SharedAiState>(aiState);
  const audioRef = useRef<number>(audioLevel);
  const reducedRef = useRef<boolean>(reducedMotion || powerSaving);
  const colorsRef = useRef({
    primary: themePreset.primaryHex,
    secondary: themePreset.secondaryHex,
    particle: themePreset.particleHex,
  });

  const dragRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    movedPx: 0,
    rotX: 0.24,
    rotY: 0.0,
    velX: 0,
    velY: 0,
    needsRender: true,
  });

  useEffect(() => {
    stateRef.current = aiState;
    dragRef.current.needsRender = true;
  }, [aiState]);

  useEffect(() => {
    audioRef.current = audioLevel;
    dragRef.current.needsRender = true;
  }, [audioLevel]);

  useEffect(() => {
    reducedRef.current = reducedMotion || powerSaving;
    dragRef.current.needsRender = true;
  }, [reducedMotion, powerSaving]);

  useEffect(() => {
    colorsRef.current = {
      primary: themePreset.primaryHex,
      secondary: themePreset.secondaryHex,
      particle: themePreset.particleHex,
    };
    dragRef.current.needsRender = true;
  }, [themePreset.primaryHex, themePreset.secondaryHex, themePreset.particleHex]);

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const width = Math.max(180, host.clientWidth || 320);
    const height = Math.max(180, host.clientHeight || 320);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setWebglFallback(true));
      return;
    }

    const maxDpr = isMobile ? 1.5 : 2;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.25);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Primary Wireframe Geodesic Sphere
    const outerGeo = new THREE.IcosahedronGeometry(1.18, 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorsRef.current.primary),
      wireframe: true,
      transparent: true,
      opacity: 0.56,
    });
    const outerSphere = new THREE.Mesh(outerGeo, outerMat);
    rootGroup.add(outerSphere);

    // 2. Inner Crystalline Energy Lattice
    const innerGeo = new THREE.IcosahedronGeometry(0.72, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorsRef.current.secondary),
      wireframe: true,
      transparent: true,
      opacity: 0.72,
    });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    rootGroup.add(innerSphere);

    // 3. Central Core Point Halo
    const coreGeo = new THREE.SphereGeometry(0.28, 20, 20);
    const coreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorsRef.current.particle),
      transparent: true,
      opacity: 0.65,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    rootGroup.add(coreMesh);

    // 4. Three Orbiting Gyroscopic Rings + Node Markers
    const ring1Geo = new THREE.TorusGeometry(1.56, 0.014, 12, 96);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorsRef.current.primary),
      transparent: true,
      opacity: 0.78,
    });
    const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
    ring1.rotation.set(Math.PI * 0.38, 0.25, 0);
    rootGroup.add(ring1);

    const ring2Geo = new THREE.TorusGeometry(1.78, 0.011, 12, 96);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorsRef.current.secondary),
      transparent: true,
      opacity: 0.62,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.set(-Math.PI * 0.28, -0.45, 0.4);
    rootGroup.add(ring2);

    const ring3Geo = new THREE.TorusGeometry(1.98, 0.008, 10, 96);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorsRef.current.particle),
      transparent: true,
      opacity: 0.42,
    });
    const ring3 = new THREE.Mesh(ring3Geo, ring3Mat);
    ring3.rotation.set(Math.PI * 0.12, Math.PI * 0.42, 0.2);
    rootGroup.add(ring3);

    // Orbital calibration nodes attached to ring1
    const nodeGeo = new THREE.SphereGeometry(0.038, 8, 8);
    const nodeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorsRef.current.particle),
      transparent: true,
      opacity: 0.9,
    });
    const ringNodes: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const n = new THREE.Mesh(nodeGeo, nodeMat);
      const ang = (i / 4) * Math.PI * 2;
      n.position.set(Math.cos(ang) * 1.56, Math.sin(ang) * 1.56, 0);
      ring1.add(n);
      ringNodes.push(n);
    }

    // 5. Seeded Orbital Particle Field
    const particleCount = isMobile ? 150 : 260;
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(createDeterministicParticles(particleCount), 3)
    );
    const particleMat = new THREE.PointsMaterial({
      color: new THREE.Color(colorsRef.current.particle),
      size: isMobile ? 0.042 : 0.034,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particles);

    const resizeObserver = new ResizeObserver((entries) => {
      if (!renderer || entries.length === 0) return;
      const { width: w, height: h } = entries[0].contentRect;
      if (w < 10 || h < 10) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      dragRef.current.needsRender = true;
    });
    resizeObserver.observe(host);

    let rafId = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let smoothAudio = 0;
    let disposed = false;

    const renderScene = (now: number) => {
      if (disposed || !renderer) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const isHidden = typeof document !== 'undefined' && document.hidden;
      const isReduced = reducedRef.current;
      const currentState = stateRef.current;
      const targetAudio = currentState === 'idle' ? 0 : audioRef.current;
      smoothAudio += (targetAudio - smoothAudio) * 0.18;

      // Sync theme colors cleanly
      outerMat.color.set(colorsRef.current.primary);
      ring1Mat.color.set(colorsRef.current.primary);
      innerMat.color.set(colorsRef.current.secondary);
      ring2Mat.color.set(colorsRef.current.secondary);
      coreMat.color.set(colorsRef.current.particle);
      ring3Mat.color.set(colorsRef.current.particle);
      particleMat.color.set(colorsRef.current.particle);
      nodeMat.color.set(colorsRef.current.particle);

      const speedMult = getStateSpeedMultiplier(currentState);
      if (!isReduced && !isHidden) {
        elapsed += dt * speedMult;
        if (!dragRef.current.active) {
          dragRef.current.rotY += dt * 0.24 * speedMult + dragRef.current.velY;
          dragRef.current.rotX += dragRef.current.velX;
          dragRef.current.velX *= 0.92;
          dragRef.current.velY *= 0.92;
          dragRef.current.rotX = Math.max(-1.25, Math.min(1.25, dragRef.current.rotX));
        }
      }

      rootGroup.rotation.x = dragRef.current.rotX;
      rootGroup.rotation.y = dragRef.current.rotY;

      // State-driven (non-random) harmonic scale & ring rotation
      const stateScaleBoost =
        currentState === 'speaking'
          ? 1 + smoothAudio * 0.14 + Math.sin(elapsed * 4.2) * 0.025
          : currentState === 'listening'
            ? 1 + smoothAudio * 0.1
            : currentState === 'thinking'
              ? 1 + Math.sin(elapsed * 3.0) * 0.02
              : 1;

      outerSphere.scale.setScalar(stateScaleBoost);
      innerSphere.scale.setScalar(
        currentState === 'speaking' ? 1 + smoothAudio * 0.24 : currentState === 'thinking' ? 1.08 : 1
      );
      coreMesh.scale.setScalar(
        currentState === 'idle' ? 0.95 : 1.05 + smoothAudio * 0.45
      );

      outerMat.opacity =
        currentState === 'idle' ? 0.5 : Math.min(0.92, 0.62 + smoothAudio * 0.3);
      innerMat.opacity =
        currentState === 'idle' ? 0.6 : Math.min(0.95, 0.72 + smoothAudio * 0.25);
      coreMat.opacity =
        currentState === 'idle' ? 0.48 : Math.min(0.95, 0.65 + smoothAudio * 0.3);

      if (!isReduced) {
        innerSphere.rotation.y = -elapsed * 0.65;
        innerSphere.rotation.x = elapsed * 0.3;
        ring1.rotation.z = elapsed * 0.55;
        ring2.rotation.z = -elapsed * 0.48;
        ring3.rotation.y = elapsed * 0.34;
        particles.rotation.y = elapsed * 0.18;
      }

      renderer.render(scene, camera);
      dragRef.current.needsRender = false;

      if (!isReduced && !isHidden) {
        rafId = requestAnimationFrame(renderScene);
      } else {
        rafId = 0;
      }
    };

    const wakeLoopIfNeeded = () => {
      if (disposed) return;
      if (!reducedRef.current && !document.hidden && rafId === 0) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(renderScene);
      } else if (dragRef.current.needsRender && rafId === 0) {
        renderScene(performance.now());
      }
    };

    const handleVisibility = () => {
      if (!document.hidden) {
        dragRef.current.needsRender = true;
        wakeLoopIfNeeded();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Kick initial render
    rafId = requestAnimationFrame(renderScene);
    const intervalSync = window.setInterval(() => {
      if (dragRef.current.needsRender) {
        wakeLoopIfNeeded();
      }
    }, 150);

    return () => {
      disposed = true;
      window.clearInterval(intervalSync);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      ringNodes.length = 0;
      outerGeo.dispose();
      outerMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      ring1Geo.dispose();
      ring1Mat.dispose();
      ring2Geo.dispose();
      ring2Mat.dispose();
      ring3Geo.dispose();
      ring3Mat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement.parentElement === host) {
          host.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  const heightClass =
    size === 'sm'
      ? 'h-48 sm:h-56'
      : size === 'md'
        ? 'h-64 sm:h-72'
        : 'h-[280px] sm:h-[340px] lg:h-[370px]';

  const stateBadgeStyle = (() => {
    switch (aiState) {
      case 'listening':
        return 'bg-cyan-500/20 border-cyan-400/70 text-cyan-200';
      case 'thinking':
        return 'bg-sky-500/20 border-sky-400/70 text-sky-200';
      case 'speaking':
        return 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200';
      case 'idle':
      default:
        return 'bg-[#071529]/85 border-cyan-500/35 text-cyan-200';
    }
  })();

  const handleResetOrbit = (e: React.MouseEvent) => {
    e.stopPropagation();
    dragRef.current.rotX = 0.24;
    dragRef.current.rotY = 0;
    dragRef.current.velX = 0;
    dragRef.current.velY = 0;
    dragRef.current.needsRender = true;
  };

  return (
    <div
      data-testid="hologram-sphere-3d"
      data-ai-state={aiState}
      className={`relative w-full ${heightClass} select-none ${className}`}
    >
      {/* Top Status & Drag Hint */}
      <div className="pointer-events-none absolute top-2 left-2 right-2 z-10 flex items-center justify-between gap-2">
        <span
          data-testid="shared-ai-state-badge"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono-hud text-[10px] font-bold tracking-wider backdrop-blur-sm ${stateBadgeStyle}`}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: themePreset.primaryHex }}
          />
          <span>AI: {stateLabel}</span>
        </span>

        {interactive && (
          <button
            type="button"
            onClick={handleResetOrbit}
            title="Reset 3D Hologram Orientation"
            aria-label="Reset 3D Hologram Orientation"
            className="pointer-events-auto inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#051020]/85 border border-cyan-500/35 hover:border-cyan-300 font-mono-hud text-[9px] text-cyan-200 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">DRAG TO ROTATE</span>
          </button>
        )}
      </div>

      {/* Three.js Canvas Mount (or honest 2D wireframe fallback if WebGL unavailable) */}
      <div
        ref={containerRef}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label="Interactive 3D Holographic Sphere — drag to rotate"
        className="w-full h-full touch-none cursor-grab active:cursor-grabbing rounded-2xl focus-visible:outline-2"
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onClick();
          }
        }}
        onPointerDown={(e) => {
          if (!interactive) return;
          dragRef.current.active = true;
          dragRef.current.lastX = e.clientX;
          dragRef.current.lastY = e.clientY;
          dragRef.current.movedPx = 0;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore capture error
          }
        }}
        onPointerMove={(e) => {
          if (!interactive || !dragRef.current.active) return;
          const dx = e.clientX - dragRef.current.lastX;
          const dy = e.clientY - dragRef.current.lastY;
          dragRef.current.lastX = e.clientX;
          dragRef.current.lastY = e.clientY;
          dragRef.current.movedPx += Math.abs(dx) + Math.abs(dy);
          dragRef.current.rotY += dx * 0.009;
          dragRef.current.rotX = Math.max(
            -1.25,
            Math.min(1.25, dragRef.current.rotX + dy * 0.009)
          );
          dragRef.current.velY = dx * 0.0025;
          dragRef.current.velX = dy * 0.0025;
          dragRef.current.needsRender = true;
        }}
        onPointerUp={(e) => {
          if (!interactive) return;
          const wasClick = dragRef.current.movedPx < 6;
          dragRef.current.active = false;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          if (wasClick && onClick) {
            onClick();
          }
        }}
        onPointerLeave={() => {
          dragRef.current.active = false;
        }}
      >
        {webglFallback && (
          <div className="w-full h-full flex flex-col items-center justify-center rounded-2xl border border-cyan-500/30 bg-[#040B17]/70 p-4 text-center">
            <div
              className="w-32 h-32 rounded-full border-2 border-dashed flex items-center justify-center animate-spin"
              style={{ borderColor: themePreset.primaryHex }}
            >
              <div
                className="w-20 h-20 rounded-full border"
                style={{ borderColor: themePreset.secondaryHex }}
              />
            </div>
            <p className="mt-2 font-mono-hud text-[10px] text-cyan-200">
              WebGL unavailable — 2D Hologram Standby ({stateLabel})
            </p>
          </div>
        )}
      </div>

      {/* Optional subtle bottom telemetry label */}
      {(centerTopLabel || centerBottomLabel) && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full bg-[#040B17]/80 border border-cyan-500/30 backdrop-blur-sm flex items-center gap-2 whitespace-nowrap">
          {centerTopLabel && (
            <span className="font-mono-hud text-[10px] font-bold text-cyan-200">
              {centerTopLabel}
            </span>
          )}
          {centerBottomLabel && (
            <span className="font-mono-hud text-[9px] text-slate-400">
              {centerBottomLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
