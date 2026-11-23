import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { UltronShapeForm, UltronVisualMode } from '../types/jarvis';

interface UltronHologramCanvasProps {
  mode: UltronVisualMode;
  shape: UltronShapeForm;
  audioLevel: number;
  reducedMotion?: boolean;
  onCanvasReady?: (webglActive: boolean) => void;
}

const REFERENCE_IMAGE_SRC = '/ultron-reference.jpg';

const AVATAR_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AVATAR_FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uAudio;
  uniform float uHologram;
  uniform float uEnergy;
  uniform float uThinking;
  uniform float uListening;
  uniform float uSpeaking;
  uniform float uMorphPulse;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - vec2(0.5);
    float dist = length(centered);

    // Discard cleanly outside circular holographic aperture
    if (dist > 0.5) {
      discard;
    }

    // Subtle vocal/energy radial pulse distortion preserving core identity
    float ripple = sin(dist * 26.0 - uTime * (4.0 + uSpeaking * 6.0 + uEnergy * 5.0))
      * (0.004 + uAudio * 0.016 + uMorphPulse * 0.014);
    vec2 dir = dist > 0.0001 ? centered / dist : vec2(0.0);
    vec2 sampleUv = clamp(vUv + dir * ripple, 0.01, 0.99);

    vec4 texColor = texture2D(uTexture, sampleUv);

    // Circular soft edge feather so screenshot blends smoothly into dark 3D HUD
    float radialMask = 1.0 - smoothstep(0.36, 0.50, dist);

    // Outer cyan / amber Fresnel rim
    float rim = smoothstep(0.28, 0.48, dist) * (1.0 - smoothstep(0.47, 0.50, dist));

    vec3 color = texColor.rgb;

    // Slight vocal brightness modulation on speaking / answering
    float vocalBoost = 1.0 + uSpeaking * (0.14 + uAudio * 0.45) + uEnergy * 0.35 + uMorphPulse * 0.32;
    color *= vocalBoost;

    // Energy mode intensifies molten amber & bright plasma highlights
    color += vec3(1.0, 0.62, 0.14) * uEnergy * (0.16 + 0.18 * (1.0 - dist));

    // Listening mode adds cool cyan scanner ring pulse
    float listenRing = exp(-pow((dist - (0.38 + 0.04 * sin(uTime * 4.5))) * 22.0, 2.0));
    color += vec3(0.0, 0.9, 1.0) * uListening * (0.28 * listenRing + 0.06);

    // Thinking mode sweeps orbital violet/cyan neural shimmer
    float angle = atan(centered.y, centered.x);
    float thinkSweep = 0.5 + 0.5 * sin(angle * 3.0 - uTime * 5.2 + dist * 12.0);
    color += vec3(0.18, 0.62, 1.0) * uThinking * thinkSweep * 0.28;

    // Hologram mode adds crisp translucent laser scanlines & cyan tint shift
    float scanline = 0.5 + 0.5 * sin(vUv.y * 170.0 - uTime * 9.0);
    float holoSweep = exp(-pow((fract(vUv.y - uTime * 0.32) - 0.5) * 14.0, 2.0));
    vec3 holoShift = mix(color, vec3(dot(color, vec3(0.299, 0.587, 0.114))) * vec3(0.45, 1.05, 1.35), 0.52);
    color = mix(color, holoShift * (0.78 + 0.24 * scanline) + vec3(0.0, 0.88, 1.0) * holoSweep * 0.26, uHologram);

    // Cyan/amber glowing aperture rim
    vec3 rimColor = mix(vec3(0.0, 0.90, 1.0), vec3(1.0, 0.68, 0.16), uEnergy * 0.72);
    color += rimColor * rim * (0.55 + uAudio * 0.55 + uMorphPulse * 0.6);

    float alpha = radialMask * mix(0.95, 0.72, uHologram);
    gl_FragColor = vec4(color, alpha);
  }
`;

/**
 * Crops the golden holographic core cleanly out of the portrait reference screenshot
 * so top/bottom black screenshot borders never appear inside the 3D sphere.
 */
function buildCroppedReferenceCanvasTexture(img: HTMLImageElement): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const iw = img.naturalWidth || img.width || 1080;
    const ih = img.naturalHeight || img.height || 1657;

    // For tall phone screenshot (ratio > 1.25), crop tightly around the golden lattice core
    if (ih / Math.max(1, iw) > 1.2) {
      const sSize = Math.round(Math.min(iw * 0.74, ih * 0.45));
      const sx = Math.round(iw * 0.49 - sSize / 2);
      const sy = Math.round(ih * 0.505 - sSize / 2);
      ctx.drawImage(
        img,
        Math.max(0, sx),
        Math.max(0, sy),
        Math.min(iw, sSize),
        Math.min(ih, sSize),
        0,
        0,
        size,
        size
      );
    } else {
      const sSize = Math.min(iw, ih);
      const sx = Math.round((iw - sSize) / 2);
      const sy = Math.round((ih - sSize) / 2);
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function buildFallbackCoreTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
    grad.addColorStop(0, '#FFF3B0');
    grad.addColorStop(0.28, '#F59E0B');
    grad.addColorStop(0.65, '#0EA5E9');
    grad.addColorStop(1, 'rgba(2, 5, 11, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createShapeGeometry(shape: UltronShapeForm): THREE.BufferGeometry {
  switch (shape) {
    case 'icosahedron':
      return new THREE.IcosahedronGeometry(1.42, 1);
    case 'octahedron':
      return new THREE.OctahedronGeometry(1.48, 1);
    case 'torus_knot':
      return new THREE.TorusKnotGeometry(1.02, 0.28, 96, 14, 2, 3);
    case 'helix': {
      // Custom dual-helix tube-like point & line lattice geometry
      const pts: number[] = [];
      const segments = 120;
      for (let i = 0; i < segments; i++) {
        const t = i / (segments - 1);
        const angle = t * Math.PI * 5;
        const y = (t - 0.5) * 2.55;
        const radius = 1.15 - Math.abs(t - 0.5) * 0.35;
        pts.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        pts.push(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);
        if (i % 4 === 0) {
          pts.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
          pts.push(Math.cos(angle + Math.PI) * radius, y, Math.sin(angle + Math.PI) * radius);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      return geo;
    }
    case 'sphere':
    default:
      return new THREE.SphereGeometry(1.42, 22, 16);
  }
}

function buildParticleShellPositions(shape: UltronShapeForm, count = 420): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const phi = Math.acos(1 - 2 * ((i + 0.5) / count));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;

    if (shape === 'torus_knot') {
      const u = t * Math.PI * 12;
      const p = 2;
      const q = 3;
      const r = 1.05 + 0.34 * Math.cos(q * u);
      positions[i * 3] = r * Math.cos(p * u);
      positions[i * 3 + 1] = 0.42 * Math.sin(q * u);
      positions[i * 3 + 2] = r * Math.sin(p * u);
    } else if (shape === 'helix') {
      const strand = i % 2 === 0 ? 0 : Math.PI;
      const h = (t - 0.5) * 2.75;
      const ang = t * Math.PI * 8 + strand;
      const rad = 1.24 - Math.abs(t - 0.5) * 0.32;
      positions[i * 3] = Math.cos(ang) * rad;
      positions[i * 3 + 1] = h;
      positions[i * 3 + 2] = Math.sin(ang) * rad;
    } else if (shape === 'octahedron') {
      let x = Math.sin(phi) * Math.cos(theta);
      let y = Math.cos(phi);
      let z = Math.sin(phi) * Math.sin(theta);
      const l1 = Math.max(0.001, Math.abs(x) + Math.abs(y) + Math.abs(z));
      const scale = 1.62 / l1;
      x *= scale;
      y *= scale;
      z *= scale;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    } else if (shape === 'icosahedron') {
      const rad = 1.54 + 0.08 * Math.sin(theta * 5);
      positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = rad * Math.cos(phi);
      positions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    } else {
      const rad = 1.46 + (i % 7) * 0.035;
      positions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = rad * Math.cos(phi);
      positions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    }
  }
  return positions;
}

export const UltronHologramCanvas: React.FC<UltronHologramCanvasProps> = ({
  mode,
  shape,
  audioLevel,
  reducedMotion = false,
  onCanvasReady,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  const liveStateRef = useRef({
    mode,
    shape,
    audioLevel,
    reducedMotion,
    morphPulse: 0,
    lastShape: shape,
  });

  useEffect(() => {
    const prevShape = liveStateRef.current.lastShape;
    liveStateRef.current.mode = mode;
    liveStateRef.current.shape = shape;
    liveStateRef.current.audioLevel = Math.min(1, Math.max(0, audioLevel));
    liveStateRef.current.reducedMotion = reducedMotion;
    if (prevShape !== shape) {
      liveStateRef.current.morphPulse = 1.0;
      liveStateRef.current.lastShape = shape;
    }
  }, [mode, shape, audioLevel, reducedMotion]);

  const activeShapeRebuildRef = useRef<((nextShape: UltronShapeForm) => void) | null>(null);

  useEffect(() => {
    activeShapeRebuildRef.current?.(shape);
  }, [shape]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      onCanvasReady?.(false);
      return undefined;
    }

    if (!renderer.getContext()) {
      renderer.dispose();
      onCanvasReady?.(false);
      return undefined;
    }

    onCanvasReady?.(true);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const width = Math.max(240, host.clientWidth || 440);
    const height = Math.max(240, host.clientHeight || 440);
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.1);

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Uploaded Reference Avatar Core Plane + Holographic Shader
    const fallbackTexture = buildFallbackCoreTexture();
    let loadedRefTexture: THREE.CanvasTexture | null = null;

    const uniforms = {
      uTexture: { value: fallbackTexture as THREE.Texture },
      uTime: { value: 0 },
      uAudio: { value: 0 },
      uHologram: { value: 0 },
      uEnergy: { value: 0 },
      uThinking: { value: 0 },
      uListening: { value: 0 },
      uSpeaking: { value: 0 },
      uMorphPulse: { value: 0 },
    };

    const avatarMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: AVATAR_VERTEX_SHADER,
      fragmentShader: AVATAR_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const avatarPlaneGeo = new THREE.PlaneGeometry(2.45, 2.45);
    const avatarMesh = new THREE.Mesh(avatarPlaneGeo, avatarMaterial);
    avatarMesh.position.z = 0.05;
    rootGroup.add(avatarMesh);

    // Load exact uploaded reference image safely and apply cropped core texture
    const refImg = new Image();
    refImg.crossOrigin = 'anonymous';
    refImg.onload = () => {
      try {
        loadedRefTexture = buildCroppedReferenceCanvasTexture(refImg);
        uniforms.uTexture.value = loadedRefTexture;
      } catch {
        // Retain procedural fallback texture if image processing fails
      }
    };
    refImg.src = REFERENCE_IMAGE_SRC;

    // 2. Dynamic Morphing Wireframe Geometry around the Avatar Core
    const morphGroup = new THREE.Group();
    rootGroup.add(morphGroup);

    const wireMaterial = new THREE.LineBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.48,
    });

    const amberWireMaterial = new THREE.LineBasicMaterial({
      color: 0xffb020,
      transparent: true,
      opacity: 0.35,
    });

    let currentSourceGeo: THREE.BufferGeometry = createShapeGeometry(liveStateRef.current.shape);
    let currentEdgesGeo: THREE.BufferGeometry = new THREE.WireframeGeometry(currentSourceGeo);
    let outerWire = new THREE.LineSegments(currentEdgesGeo, wireMaterial);
    morphGroup.add(outerWire);

    let innerWire = new THREE.LineSegments(currentEdgesGeo, amberWireMaterial);
    innerWire.scale.setScalar(0.84);
    morphGroup.add(innerWire);

    // 3. Morphing 3D Particle Lattice Cloud
    const particleCount = 420;
    const initialPositions = buildParticleShellPositions(liveStateRef.current.shape, particleCount);
    const currentPositions = new Float32Array(initialPositions);
    let targetPositions = initialPositions;

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(currentPositions, 3));
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffbe3b,
      size: 0.055,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particleCloud = new THREE.Points(particleGeo, particleMaterial);
    morphGroup.add(particleCloud);

    activeShapeRebuildRef.current = (nextShape: UltronShapeForm) => {
      const nextSource = createShapeGeometry(nextShape);
      const nextEdges =
        nextShape === 'helix' ? nextSource : new THREE.WireframeGeometry(nextSource);

      morphGroup.remove(outerWire);
      morphGroup.remove(innerWire);
      if (currentEdgesGeo !== currentSourceGeo) currentEdgesGeo.dispose();
      currentSourceGeo.dispose();

      currentSourceGeo = nextSource;
      currentEdgesGeo = nextEdges;
      outerWire = new THREE.LineSegments(currentEdgesGeo, wireMaterial);
      innerWire = new THREE.LineSegments(currentEdgesGeo, amberWireMaterial);
      innerWire.scale.setScalar(0.84);
      morphGroup.add(outerWire);
      morphGroup.add(innerWire);

      targetPositions = buildParticleShellPositions(nextShape, particleCount);
    };

    // 4. Orbital HUD Rings
    const ringGeo1 = new THREE.TorusGeometry(1.78, 0.015, 12, 96);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.55,
    });
    const orbitalRing1 = new THREE.Mesh(ringGeo1, ringMat1);
    orbitalRing1.rotation.x = Math.PI * 0.34;
    rootGroup.add(orbitalRing1);

    const ringGeo2 = new THREE.TorusGeometry(1.94, 0.011, 12, 96);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45,
    });
    const orbitalRing2 = new THREE.Mesh(ringGeo2, ringMat2);
    orbitalRing2.rotation.y = Math.PI * 0.28;
    orbitalRing2.rotation.x = -Math.PI * 0.25;
    rootGroup.add(orbitalRing2);

    // 5. Radial 3D Voice Waveform Ring (48 audio-reactive bars)
    const waveGroup = new THREE.Group();
    rootGroup.add(waveGroup);
    const barGeo = new THREE.BoxGeometry(0.032, 0.16, 0.032);
    const barMatCyan = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.78,
    });
    const barMatAmber = new THREE.MeshBasicMaterial({
      color: 0xffb020,
      transparent: true,
      opacity: 0.85,
    });
    const waveBars: THREE.Mesh[] = [];
    const barCount = 48;
    for (let i = 0; i < barCount; i++) {
      const bar = new THREE.Mesh(barGeo, i % 2 === 0 ? barMatCyan : barMatAmber);
      const angle = (i / barCount) * Math.PI * 2;
      const r = 1.62;
      bar.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0.02);
      bar.rotation.z = angle - Math.PI / 2;
      waveGroup.add(bar);
      waveBars.push(bar);
    }

    // Smooth interactive pointer tilt
    let targetTiltX = 0;
    let targetTiltY = 0;
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer?.domElement.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetTiltY = nx * 0.34;
      targetTiltX = -ny * 0.24;
    };
    const onPointerLeave = () => {
      targetTiltX = 0;
      targetTiltY = 0;
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || !renderer) return;
      const w = Math.max(200, Math.round(entry.contentRect.width));
      const h = Math.max(200, Math.round(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(host);

    // Smoothly interpolated visual weights
    let wHolo = 0;
    let wEnergy = 0;
    let wThink = 0;
    let wListen = 0;
    let wSpeak = 0;
    let smoothedAudio = 0;

    let rafId = 0;
    let lastTs = performance.now();
    let elapsed = 0;

    const animate = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      const state = liveStateRef.current;
      const motionScale = state.reducedMotion ? 0.18 : 1.0;
      elapsed += dt * motionScale;

      const targetHolo = state.mode === 'hologram' ? 1 : 0;
      const targetEnergy = state.mode === 'energy' ? 1 : 0;
      const targetThink = state.mode === 'thinking' ? 1 : 0;
      const targetListen = state.mode === 'listening' ? 1 : 0;
      const targetSpeak = state.mode === 'speaking' || state.mode === 'answering' ? 1 : 0;

      const lerpFactor = Math.min(1, dt * 5.2);
      wHolo += (targetHolo - wHolo) * lerpFactor;
      wEnergy += (targetEnergy - wEnergy) * lerpFactor;
      wThink += (targetThink - wThink) * lerpFactor;
      wListen += (targetListen - wListen) * lerpFactor;
      wSpeak += (targetSpeak - wSpeak) * lerpFactor;

      // Audio responsiveness (also drives gentle harmonic pulse while TTS is speaking)
      const syntheticSpeakAudio =
        wSpeak > 0.2 && state.audioLevel < 0.08
          ? 0.28 + 0.22 * Math.sin(elapsed * 11.5) * Math.cos(elapsed * 4.7)
          : 0;
      const desiredAudio = Math.max(state.audioLevel, syntheticSpeakAudio);
      smoothedAudio += (desiredAudio - smoothedAudio) * Math.min(1, dt * 12);

      state.morphPulse = Math.max(0, state.morphPulse - dt * 1.45);

      // Update shader uniforms
      uniforms.uTime.value = elapsed;
      uniforms.uAudio.value = smoothedAudio;
      uniforms.uHologram.value = wHolo;
      uniforms.uEnergy.value = wEnergy;
      uniforms.uThinking.value = wThink;
      uniforms.uListening.value = wListen;
      uniforms.uSpeaking.value = wSpeak;
      uniforms.uMorphPulse.value = state.morphPulse;

      // Smooth particle cloud morph toward targetPositions
      const posAttr = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;
      const posLerp = Math.min(1, dt * 6.5);
      for (let i = 0; i < posArr.length; i++) {
        posArr[i] += (targetPositions[i] - posArr[i]) * posLerp;
      }
      posAttr.needsUpdate = true;

      // Dynamic geometry rotations driven by AI state
      const spinMult = 1 + wThink * 2.3 + wEnergy * 1.65 + wSpeak * 0.75 + smoothedAudio * 1.4;
      morphGroup.rotation.y += dt * 0.38 * spinMult * motionScale;
      morphGroup.rotation.x += dt * (0.14 + wThink * 0.45) * motionScale;
      innerWire.rotation.y -= dt * 0.65 * spinMult * motionScale;
      innerWire.rotation.z += dt * 0.28 * spinMult * motionScale;

      const coreScale =
        1 +
        Math.sin(elapsed * 2.2) * 0.025 +
        smoothedAudio * 0.14 +
        wEnergy * 0.09 +
        state.morphPulse * 0.18;
      morphGroup.scale.setScalar(coreScale);
      avatarMesh.scale.setScalar(1 + smoothedAudio * 0.08 + wEnergy * 0.07 + state.morphPulse * 0.1);

      // Material colors & opacities per visual mode
      wireMaterial.color.setHex(wEnergy > 0.5 ? 0xffb020 : 0x00e5ff);
      wireMaterial.opacity = Math.min(0.95, 0.38 + wHolo * 0.34 + wEnergy * 0.32 + smoothedAudio * 0.25);
      amberWireMaterial.color.setHex(wHolo > 0.5 ? 0x38bdf8 : 0xffb020);
      amberWireMaterial.opacity = Math.min(0.85, 0.26 + wEnergy * 0.42 + wThink * 0.28);
      particleMaterial.color.setHex(wHolo > 0.5 ? 0x38bdf8 : wEnergy > 0.5 ? 0xffd166 : 0xffbe3b);
      particleMaterial.size = 0.05 + wEnergy * 0.03 + smoothedAudio * 0.025;
      particleMaterial.opacity = 0.72 + wEnergy * 0.25;

      // Orbital HUD rings
      orbitalRing1.rotation.z += dt * (0.42 + wThink * 1.1) * motionScale;
      orbitalRing2.rotation.z -= dt * (0.34 + wEnergy * 1.2) * motionScale;
      ringMat1.opacity = 0.4 + wListen * 0.45 + wHolo * 0.25;
      ringMat2.opacity = 0.35 + wEnergy * 0.48 + wThink * 0.22;

      // Animate radial waveform bars
      waveGroup.rotation.z -= dt * 0.22 * motionScale;
      for (let i = 0; i < barCount; i++) {
        const bar = waveBars[i];
        const waveVal =
          Math.abs(Math.sin(elapsed * (3.2 + wSpeak * 4.5 + wListen * 3.0) + i * 0.42)) *
          (0.18 + smoothedAudio * 1.9 + wSpeak * 0.55 + wListen * 0.45 + wEnergy * 0.45);
        bar.scale.y = Math.max(0.28, 0.35 + waveVal);
      }

      // Pointer parallax tilt on rootGroup
      rootGroup.rotation.x += (targetTiltX - rootGroup.rotation.x) * Math.min(1, dt * 6);
      rootGroup.rotation.y += (targetTiltY - rootGroup.rotation.y) * Math.min(1, dt * 6);

      renderer?.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      if (renderer) {
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        if (renderer.domElement.parentNode === host) {
          host.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }
      if (currentEdgesGeo !== currentSourceGeo) currentEdgesGeo.dispose();
      currentSourceGeo.dispose();
      avatarPlaneGeo.dispose();
      avatarMaterial.dispose();
      fallbackTexture.dispose();
      loadedRefTexture?.dispose();
      wireMaterial.dispose();
      amberWireMaterial.dispose();
      particleGeo.dispose();
      particleMaterial.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      barGeo.dispose();
      barMatCyan.dispose();
      barMatAmber.dispose();
    };
  }, [onCanvasReady]);

  // Monitor canvas presence so if WebGL fails asynchronously we render 2D reference fallback
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const timer = window.setTimeout(() => {
      if (!host.querySelector('canvas')) {
        setWebglFailed(true);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  const isAnimatedRing = !reducedMotion;

  return (
    <div className="relative w-full h-full min-h-[290px] sm:min-h-[370px] flex items-center justify-center select-none overflow-hidden">
      {/* Holographic Ambient Radial Halo */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          mode === 'energy'
            ? 'opacity-95 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.26)_0%,rgba(0,229,255,0.14)_42%,transparent_72%)]'
            : mode === 'hologram'
              ? 'opacity-95 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.26)_0%,rgba(56,189,248,0.12)_48%,transparent_74%)]'
              : mode === 'thinking'
                ? 'opacity-90 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.24)_0%,rgba(0,229,255,0.15)_45%,transparent_72%)]'
                : 'opacity-85 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.16)_0%,rgba(0,229,255,0.14)_42%,transparent_72%)]'
        }`}
      />

      {/* Animated Circular HUD Framing Rings */}
      <svg
        viewBox="0 0 400 400"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full max-w-[430px] max-h-[430px] m-auto opacity-75"
      >
        <circle
          cx="200"
          cy="200"
          r="182"
          fill="none"
          stroke={mode === 'energy' ? '#F59E0B' : '#00E5FF'}
          strokeOpacity="0.28"
          strokeWidth="1.2"
          strokeDasharray="10 8"
          className={isAnimatedRing ? 'origin-center animate-[spin_28s_linear_infinite]' : ''}
        />
        <circle
          cx="200"
          cy="200"
          r="164"
          fill="none"
          stroke="#00E5FF"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeDasharray="42 18 8 18"
          className={isAnimatedRing ? 'origin-center animate-[spin_18s_linear_infinite_reverse]' : ''}
        />
        <circle
          cx="200"
          cy="200"
          r="146"
          fill="none"
          stroke={mode === 'hologram' ? '#38BDF8' : '#F59E0B'}
          strokeOpacity="0.32"
          strokeWidth="1"
          strokeDasharray="3 7"
          className={isAnimatedRing ? 'origin-center animate-[spin_22s_linear_infinite]' : ''}
        />
      </svg>

      {/* WebGL Three.js Canvas Mount */}
      <div
        ref={hostRef}
        data-testid="ultron-three-canvas"
        aria-label="ULTRON AI 3D Holographic Avatar"
        className="relative z-10 w-full h-full min-h-[290px] sm:min-h-[370px]"
      />

      {/* Graceful 2D Reference Image Fallback when WebGL is unavailable */}
      {webglFailed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="relative w-60 h-60 sm:w-72 sm:h-72 rounded-full overflow-hidden border-2 border-cyan-400/60 shadow-[0_0_45px_rgba(0,229,255,0.45)]">
            <img
              src={REFERENCE_IMAGE_SRC}
              alt="ULTRON AI Holographic Avatar"
              className="w-full h-full object-cover object-center scale-150"
            />
            {mode === 'hologram' && (
              <div className="absolute inset-0 bg-cyan-400/20 mix-blend-screen animate-pulse" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
