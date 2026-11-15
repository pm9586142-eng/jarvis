import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameAudioSynth } from '../services/gameAudio';

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';
export type DifficultyMode = 'recruit' | 'vanguard' | 'ace';
export type SceneAtmosphere = 'cosmic' | 'solar' | 'nebula';
export type EnemyKind = 'scout' | 'cruiser' | 'boss';

export interface GameHudSnapshot {
  phase: GamePhase;
  score: number;
  combo: number;
  wave: number;
  maxWaves: number;
  endlessMode: boolean;
  shield: number;
  maxShield: number;
  beaconIntegrity: number;
  dashReadyRatio: number;
  enemiesRemaining: number;
  kills: number;
  inspectCamera: boolean;
  atmosphere: SceneAtmosphere;
  asteroidDensity: number;
  difficulty: DifficultyMode;
  bossHpRatio: number | null;
  bossName: string | null;
}

interface Projectile {
  active: boolean;
  fromPlayer: boolean;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  damage: number;
  radius: number;
}

interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  group: THREE.Group;
  shadow: THREE.Mesh;
  windupRing: THREE.Mesh;
  partsWithEmissive: THREE.MeshStandardMaterial[];
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  scoreValue: number;
  hitFlashTimer: number;
  fireCooldown: number;
  windupTimer: number;
  isWindingUp: boolean;
  strafeSign: number;
  spinnerA?: THREE.Object3D;
  spinnerB?: THREE.Object3D;
}

interface ParticleSlot {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface AsteroidMeta {
  angle: number;
  radius: number;
  y: number;
  speed: number;
  spinX: number;
  spinY: number;
  scale: number;
}

const ARENA_BOUND = 34;
const PLAYER_Y = 1.5;

const ATMOSPHERE_THEMES: Record<
  SceneAtmosphere,
  {
    bgHex: number;
    fogDensity: number;
    keyColor: number;
    hemiSky: number;
    hemiGround: number;
    beaconColor: number;
  }
> = {
  cosmic: {
    bgHex: 0x030712,
    fogDensity: 0.0085,
    keyColor: 0xffe6c7,
    hemiSky: 0x67e8f9,
    hemiGround: 0x090e1c,
    beaconColor: 0x22d3ee,
  },
  solar: {
    bgHex: 0x110705,
    fogDensity: 0.0095,
    keyColor: 0xffc68a,
    hemiSky: 0xfdba74,
    hemiGround: 0x1c0d08,
    beaconColor: 0xf59e0b,
  },
  nebula: {
    bgHex: 0x090418,
    fogDensity: 0.009,
    keyColor: 0xe9d5ff,
    hemiSky: 0xc084fc,
    hemiGround: 0x0d0720,
    beaconColor: 0xa855f7,
  },
};

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.32)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createArenaDeckTextures(): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const albedo = document.createElement('canvas');
  albedo.width = size;
  albedo.height = size;
  const actx = albedo.getContext('2d')!;

  const bump = document.createElement('canvas');
  bump.width = size;
  bump.height = size;
  const bctx = bump.getContext('2d')!;

  const rough = document.createElement('canvas');
  rough.width = size;
  rough.height = size;
  const rctx = rough.getContext('2d')!;

  actx.fillStyle = '#091224';
  actx.fillRect(0, 0, size, size);

  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  rctx.fillStyle = '#9c9c9c';
  rctx.fillRect(0, 0, size, size);

  // Brushed hull plates
  const step = 64;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const tone = ((x / step + y / step) % 2 === 0 ? 14 : 9);
      actx.fillStyle = `rgb(${tone}, ${tone + 12}, ${tone + 30})`;
      actx.fillRect(x + 2, y + 2, step - 4, step - 4);

      actx.strokeStyle = 'rgba(34, 211, 238, 0.16)';
      actx.lineWidth = 1.5;
      actx.strokeRect(x + 1, y + 1, step - 2, step - 2);

      bctx.strokeStyle = '#383838';
      bctx.lineWidth = 3;
      bctx.strokeRect(x + 1, y + 1, step - 2, step - 2);

      rctx.fillStyle = (x / step + y / step) % 2 === 0 ? '#686868' : '#b2b2b2';
      rctx.fillRect(x + 3, y + 3, step - 6, step - 6);
    }
  }

  // Concentric tactical arc accents
  actx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
  actx.lineWidth = 2;
  [90, 175, 240].forEach((r) => {
    actx.beginPath();
    actx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    actx.stroke();
  });

  const map = new THREE.CanvasTexture(albedo);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 4);
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bump);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(4, 4);

  const roughnessMap = new THREE.CanvasTexture(rough);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(4, 4);

  return { map, bumpMap, roughnessMap };
}

export class OrbitalAegisEngine {
  private container: HTMLElement;
  private onHudUpdate: (hud: GameHudSnapshot) => void;
  private audio: GameAudioSynth;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private pmremGenerator!: THREE.PMREMGenerator;
  private envRenderTarget!: THREE.WebGLRenderTarget;

  private keyLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private beaconLight!: THREE.PointLight;
  private fog!: THREE.FogExp2;

  private floorMesh!: THREE.Mesh;
  private shadowTex!: THREE.CanvasTexture;
  private shadowMat!: THREE.MeshBasicMaterial;
  private deckTextures!: {
    map: THREE.CanvasTexture;
    bumpMap: THREE.CanvasTexture;
    roughnessMap: THREE.CanvasTexture;
  };

  // Hero Player Assembly (10 parts)
  private playerRoot = new THREE.Group();
  private playerTilt = new THREE.Group();
  private playerShadow!: THREE.Mesh;
  private playerThrusterMat!: THREE.MeshStandardMaterial;
  private playerShieldRing!: THREE.Mesh;
  private playerPos = new THREE.Vector3(0, PLAYER_Y, 13);
  private playerVel = new THREE.Vector3();
  private playerFacing = new THREE.Vector3(0, 0, -1);

  // Central Orbital Beacon Assembly (8 parts)
  private beaconGroup = new THREE.Group();
  private beaconRingOuter!: THREE.Mesh;
  private beaconRingInner!: THREE.Mesh;
  private beaconCrystal!: THREE.Mesh;
  private beaconCrystalMat!: THREE.MeshStandardMaterial;

  // Instanced environments & particles
  private asteroidMesh!: THREE.InstancedMesh;
  private asteroidMetas: AsteroidMeta[] = [];
  private starMesh!: THREE.InstancedMesh;
  private particleMesh!: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];

  // Shared Geometries & Materials
  private projectileGeo = new THREE.SphereGeometry(0.24, 10, 10);
  private playerBulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  private enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xfb7185 });
  private projectiles: Projectile[] = [];

  // Enemy pool/list
  private enemies: EnemyEntity[] = [];
  private nextEnemyId = 1;

  // Simulation State
  private phase: GamePhase = 'title';
  private difficulty: DifficultyMode = 'vanguard';
  private atmosphere: SceneAtmosphere = 'cosmic';
  private asteroidDensity = 1;
  private inspectCamera = false;

  private score = 0;
  private combo = 1;
  private comboTimer = 0;
  private wave = 1;
  private readonly maxWaves = 3;
  private endlessMode = false;
  private kills = 0;

  private shield = 100;
  private maxShield = 100;
  private beaconIntegrity = 100;
  private invulnTimer = 0;
  private hitstopTimer = 0;
  private shakeIntensity = 0;

  private fireCooldown = 0;
  private fireBufferTimer = 0;
  private dashCooldown = 0;
  private readonly dashMaxCooldown = 1.65;
  private dashBufferTimer = 0;
  private dashActiveTimer = 0;
  private dashDir = new THREE.Vector3(0, 0, -1);

  // Input state (separated held vs justPressed)
  private heldKeys = new Set<string>();
  private pointerDown = false;
  private pointerHasMoved = false;
  private pointerNdc = new THREE.Vector2();
  private touchMoveVec = new THREE.Vector2(0, 0);

  // Frame loop & scratch objects (zero per-frame allocations)
  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private hudEmitAccum = 0;
  private raycaster = new THREE.Raycaster();
  private combatPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PLAYER_Y);
  private readonly scratchVecA = new THREE.Vector3();
  private readonly scratchVecB = new THREE.Vector3();
  private readonly scratchVecC = new THREE.Vector3();
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchMat = new THREE.Matrix4();
  private readonly scratchScale = new THREE.Vector3(1, 1, 1);

  private disposed = false;

  constructor(
    container: HTMLElement,
    audio: GameAudioSynth,
    onHudUpdate: (hud: GameHudSnapshot) => void
  ) {
    this.container = container;
    this.audio = audio;
    this.onHudUpdate = onHudUpdate;

    this.initScene();
    this.initLightingAndAtmosphere();
    this.initArenaFloor();
    this.initBeaconModel();
    this.initPlayerModel();
    this.initInstancedEnvironment();
    this.initParticlePool();
    this.bindEvents();

    this.emitHud(true);
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private initScene(): void {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const theme = ATMOSPHERE_THEMES[this.atmosphere];
    this.scene.background = new THREE.Color(theme.bgHex);
    this.fog = new THREE.FogExp2(theme.bgHex, theme.fogDensity);
    this.scene.fog = this.fog;

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = this.pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();

    this.camera = new THREE.PerspectiveCamera(52, width / height, 0.3, 240);
    this.camera.position.set(0, 19, 29);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.44;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 58;
    this.controls.enabled = false;
  }

  private initLightingAndAtmosphere(): void {
    const theme = ATMOSPHERE_THEMES[this.atmosphere];

    this.hemiLight = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, 0.9);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(theme.keyColor, 2.75);
    this.keyLight.position.set(18, 28, 16);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 4;
    this.keyLight.shadow.camera.far = 75;
    this.keyLight.shadow.camera.left = -28;
    this.keyLight.shadow.camera.right = 28;
    this.keyLight.shadow.camera.top = 28;
    this.keyLight.shadow.camera.bottom = -28;
    this.keyLight.shadow.bias = -0.0008;
    this.scene.add(this.keyLight);

    this.beaconLight = new THREE.PointLight(theme.beaconColor, 18, 36, 1.5);
    this.beaconLight.position.set(0, 3.8, 0);
    this.scene.add(this.beaconLight);
  }

  private initArenaFloor(): void {
    this.shadowTex = createContactShadowTexture();
    this.shadowMat = new THREE.MeshBasicMaterial({
      map: this.shadowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    });

    this.deckTextures = createArenaDeckTextures();
    const floorGeo = new THREE.CylinderGeometry(42, 44, 1.2, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      map: this.deckTextures.map,
      bumpMap: this.deckTextures.bumpMap,
      bumpScale: 0.08,
      roughnessMap: this.deckTextures.roughnessMap,
      roughness: 0.62,
      metalness: 0.45,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.position.y = -0.6;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // Outer perimeter glowing rim ring
    const rimGeo = new THREE.TorusGeometry(ARENA_BOUND + 1.2, 0.22, 12, 96);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 1.3,
      roughness: 0.25,
      metalness: 0.85,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    this.scene.add(rim);
  }

  /**
   * 8-Part Composite Procedural Model: Central Orbital Beacon
   * Pivoted at bottom-center flush with ground y = 0.
   */
  private initBeaconModel(): void {
    this.beaconGroup.position.set(0, 0, 0);

    // 1. Lathe stepped pedestal base
    const lathePts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(2.8, 0),
      new THREE.Vector2(2.6, 0.35),
      new THREE.Vector2(1.9, 0.55),
      new THREE.Vector2(1.5, 1.1),
      new THREE.Vector2(1.15, 1.45),
      new THREE.Vector2(0.01, 1.55),
    ];
    const plinthGeo = new THREE.LatheGeometry(lathePts, 24);
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x162238,
      roughness: 0.45,
      metalness: 0.82,
    });
    const plinth = new THREE.Mesh(plinthGeo, darkMetalMat);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.beaconGroup.add(plinth);

    // 2-5. Four radial buttress struts
    const strutGeo = new THREE.BoxGeometry(0.32, 1.45, 0.85);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.3,
      metalness: 0.88,
    });
    for (let i = 0; i < 4; i++) {
      const strut = new THREE.Mesh(strutGeo, trimMat);
      const a = (i * Math.PI) / 2;
      strut.position.set(Math.sin(a) * 1.9, 0.72, Math.cos(a) * 1.9);
      strut.rotation.y = a;
      strut.castShadow = true;
      this.beaconGroup.add(strut);
    }

    // 6. Floating crystalline reactor core
    this.beaconCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.0,
      roughness: 0.14,
      metalness: 0.25,
    });
    this.beaconCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), this.beaconCrystalMat);
    this.beaconCrystal.position.y = 3.25;
    this.beaconCrystal.castShadow = true;
    this.beaconGroup.add(this.beaconCrystal);

    // 7-8. Counter-rotating gyroscopic rings
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.92,
    });
    this.beaconRingOuter = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.1, 14, 48), ringMat);
    this.beaconRingOuter.position.y = 3.25;
    this.beaconGroup.add(this.beaconRingOuter);

    this.beaconRingInner = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.08, 12, 40), ringMat);
    this.beaconRingInner.position.y = 3.25;
    this.beaconGroup.add(this.beaconRingInner);

    // Contact shadow pad
    const beaconShadow = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 7.2), this.shadowMat);
    beaconShadow.rotation.x = -Math.PI / 2;
    beaconShadow.position.y = 0.02;
    this.beaconGroup.add(beaconShadow);

    this.scene.add(this.beaconGroup);
  }

  /**
   * 10-Part Composite Procedural Model: MK-VII AEGIS Player Interceptor
   */
  private initPlayerModel(): void {
    this.playerRoot.position.copy(this.playerPos);
    this.playerRoot.add(this.playerTilt);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      roughness: 0.3,
      metalness: 0.72,
    });
    const darkArmorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.52,
      metalness: 0.8,
    });
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.1,
      metalness: 0.3,
    });
    this.playerThrusterMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x22d3ee,
      emissiveIntensity: 2.4,
      roughness: 0.2,
      metalness: 0.1,
    });

    // 1. Central fuselage spine
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.45, 2.35), hullMat);
    spine.castShadow = true;
    this.playerTilt.add(spine);

    // 2. Tapered forward nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.3, 6), darkArmorMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, -0.02, -1.78);
    nose.castShadow = true;
    this.playerTilt.add(nose);

    // 3. Glossy cockpit canopy
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), canopyMat);
    canopy.scale.set(0.85, 0.58, 1.65);
    canopy.position.set(0, 0.24, -0.35);
    this.playerTilt.add(canopy);

    // 4-5. Swept delta wings via beveled ExtrudeGeometry
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(1.75, 0.85);
    wingShape.lineTo(1.55, 1.25);
    wingShape.lineTo(0.15, 0.75);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);

    const rightWing = new THREE.Mesh(wingGeo, hullMat);
    rightWing.position.set(0.35, 0.04, -0.15);
    rightWing.castShadow = true;
    this.playerTilt.add(rightWing);

    const leftWing = new THREE.Mesh(wingGeo, hullMat);
    leftWing.scale.x = -1;
    leftWing.position.set(-0.35, 0.04, -0.15);
    leftWing.castShadow = true;
    this.playerTilt.add(leftWing);

    // 6-7. Twin rear thruster nacelles
    const nacelleGeo = new THREE.CylinderGeometry(0.2, 0.24, 1.05, 12);
    nacelleGeo.rotateX(Math.PI / 2);
    [-0.58, 0.58].forEach((xOffset) => {
      const nacelle = new THREE.Mesh(nacelleGeo, darkArmorMat);
      nacelle.position.set(xOffset, 0.02, 0.85);
      nacelle.castShadow = true;
      this.playerTilt.add(nacelle);

      // 8-9. Glowing ion exhaust rings
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.19, 0.045, 8, 20),
        this.playerThrusterMat
      );
      ring.position.set(xOffset, 0.02, 1.38);
      this.playerTilt.add(ring);
    });

    // 10. Dorsal stabilizer fin & ventral pulse barrels
    const dorsalFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.85), darkArmorMat);
    dorsalFin.position.set(0, 0.36, 0.78);
    dorsalFin.rotation.x = 0.22;
    this.playerTilt.add(dorsalFin);

    const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8);
    barrelGeo.rotateX(Math.PI / 2);
    [-0.45, 0.45].forEach((xOffset) => {
      const barrel = new THREE.Mesh(barrelGeo, darkArmorMat);
      barrel.position.set(xOffset, -0.14, -1.05);
      this.playerTilt.add(barrel);
    });

    // Translucent shield halo around player
    this.playerShieldRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.75, 0.045, 10, 36),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.25,
      })
    );
    this.playerShieldRing.rotation.x = Math.PI / 2;
    this.playerRoot.add(this.playerShieldRing);

    // Contact shadow projected onto arena floor
    this.playerShadow = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.8), this.shadowMat);
    this.playerShadow.rotation.x = -Math.PI / 2;
    this.playerShadow.position.set(0, -PLAYER_Y + 0.03, 0);
    this.playerRoot.add(this.playerShadow);

    this.scene.add(this.playerRoot);
  }

  private initInstancedEnvironment(): void {
    // 1. InstancedMesh: 140 Orbiting Metallic Asteroid Shards
    const maxAsteroids = 140;
    const astGeo = new THREE.IcosahedronGeometry(1, 0);
    const astMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.78,
      metalness: 0.42,
    });
    this.asteroidMesh = new THREE.InstancedMesh(astGeo, astMat, maxAsteroids);
    this.asteroidMesh.castShadow = true;
    this.asteroidMesh.receiveShadow = true;

    for (let i = 0; i < maxAsteroids; i++) {
      this.asteroidMetas.push({
        angle: (i / maxAsteroids) * Math.PI * 2 + Math.random() * 0.35,
        radius: 38 + Math.random() * 24,
        y: (Math.random() - 0.5) * 9 + 1.5,
        speed: (0.025 + Math.random() * 0.045) * (i % 2 === 0 ? 1 : -1),
        spinX: (Math.random() - 0.5) * 1.4,
        spinY: (Math.random() - 0.5) * 1.4,
        scale: 0.45 + Math.random() * 1.25,
      });
    }
    this.scene.add(this.asteroidMesh);

    // 2. InstancedMesh: 420 Deep-Space Starfield Nodes
    const starCount = 420;
    const starGeo = new THREE.OctahedronGeometry(0.18, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
    this.starMesh = new THREE.InstancedMesh(starGeo, starMat, starCount);
    const colorScratch = new THREE.Color();
    for (let i = 0; i < starCount; i++) {
      const dist = 62 + Math.random() * 75;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.scratchVecA.set(
        dist * Math.sin(phi) * Math.cos(theta),
        Math.abs(dist * Math.cos(phi)) * 0.75 + 4,
        dist * Math.sin(phi) * Math.sin(theta)
      );
      const s = 0.6 + Math.random() * 1.5;
      this.scratchScale.set(s, s, s);
      this.scratchMat.compose(this.scratchVecA, this.scratchQuat.identity(), this.scratchScale);
      this.starMesh.setMatrixAt(i, this.scratchMat);
      colorScratch.setHSL(0.54 + Math.random() * 0.16, 0.65, 0.75 + Math.random() * 0.22);
      this.starMesh.setColorAt(i, colorScratch);
    }
    this.starMesh.instanceMatrix.needsUpdate = true;
    if (this.starMesh.instanceColor) this.starMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.starMesh);
  }

  private initParticlePool(): void {
    const count = 90;
    const geo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(geo, mat, count);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let i = 0; i < count; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.5,
        scale: 0,
        color: new THREE.Color(0x38bdf8),
      });
      this.scratchMat.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, this.scratchMat);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.particleMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.particleMesh);
  }

  private spawnParticles(origin: THREE.Vector3, count: number, hexColor: number, speed = 11): void {
    let spawned = 0;
    for (let i = 0; i < this.particles.length && spawned < count; i++) {
      const p = this.particles[i];
      if (p.active) continue;
      p.active = true;
      p.pos.copy(origin);
      const theta = Math.random() * Math.PI * 2;
      const up = (Math.random() - 0.15) * speed * 0.8;
      const spd = (0.35 + Math.random() * 0.85) * speed;
      p.vel.set(Math.cos(theta) * spd, up, Math.sin(theta) * spd);
      p.maxLife = 0.28 + Math.random() * 0.36;
      p.life = p.maxLife;
      p.scale = 0.7 + Math.random() * 1.1;
      p.color.setHex(hexColor);
      this.particleMesh.setColorAt(i, p.color);
      spawned++;
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Builds a composite 5-9 part enemy group depending on archetype.
   */
  private createEnemyEntity(kind: EnemyKind, spawnPos: THREE.Vector3): EnemyEntity {
    const group = new THREE.Group();
    group.position.copy(spawnPos);
    const emissiveMats: THREE.MeshStandardMaterial[] = [];

    const armorMat = new THREE.MeshStandardMaterial({
      color: kind === 'boss' ? 0x3b0764 : kind === 'cruiser' ? 0x334155 : 0x1e293b,
      roughness: 0.42,
      metalness: 0.78,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: kind === 'boss' ? 0xf43f5e : kind === 'cruiser' ? 0xf59e0b : 0xfb7185,
      emissive: kind === 'boss' ? 0xe11d48 : kind === 'cruiser' ? 0xd97706 : 0xf43f5e,
      emissiveIntensity: 1.5,
      roughness: 0.18,
      metalness: 0.3,
    });
    emissiveMats.push(armorMat, coreMat);

    let spinnerA: THREE.Object3D | undefined;
    let spinnerB: THREE.Object3D | undefined;

    if (kind === 'scout') {
      // 5 parts: chevron hull, left/right razor fins, glowing ruby sensor eye, rear ring
      const hull = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.8, 4), armorMat);
      hull.rotation.x = Math.PI / 2;
      hull.castShadow = true;
      group.add(hull);

      const wingGeo = new THREE.BoxGeometry(2.1, 0.12, 0.55);
      const wings = new THREE.Mesh(wingGeo, armorMat);
      wings.position.z = -0.1;
      wings.castShadow = true;
      group.add(wings);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 10), coreMat);
      eye.position.set(0, 0.15, 0.55);
      group.add(eye);

      const thruster = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 8, 16), coreMat);
      thruster.position.z = -0.9;
      group.add(thruster);
    } else if (kind === 'cruiser') {
      // 7 parts: armored hull, bridge tower, 2 rotating turret barrels, side pods, charge telegraph
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 2.5), armorMat);
      body.castShadow = true;
      group.add(body);

      const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 1.05), armorMat);
      bridge.position.set(0, 0.6, -0.25);
      bridge.castShadow = true;
      group.add(bridge);

      const podGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.8, 10);
      podGeo.rotateX(Math.PI / 2);
      [-1.18, 1.18].forEach((x) => {
        const pod = new THREE.Mesh(podGeo, armorMat);
        pod.position.set(x, 0, 0.1);
        pod.castShadow = true;
        group.add(pod);
      });

      const barrelGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.15, 8);
      barrelGeo.rotateX(Math.PI / 2);
      [-0.48, 0.48].forEach((x) => {
        const barrel = new THREE.Mesh(barrelGeo, coreMat);
        barrel.position.set(x, 0.18, 1.35);
        group.add(barrel);
      });
    } else {
      // Boss Kronos-X (9 parts): dual catamaran hulls, prow, reactor core, 2 gyro rings, cannons
      const centerHull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.05, 3.8), armorMat);
      centerHull.castShadow = true;
      group.add(centerHull);

      const prow = new THREE.Mesh(new THREE.ConeGeometry(1.45, 2.2, 5), armorMat);
      prow.rotation.x = Math.PI / 2;
      prow.position.z = 2.7;
      prow.castShadow = true;
      group.add(prow);

      [-2.1, 2.1].forEach((x) => {
        const wingPod = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 3.4), armorMat);
        wingPod.position.set(x, -0.05, -0.2);
        wingPod.castShadow = true;
        group.add(wingPod);
      });

      const reactor = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), coreMat);
      reactor.position.set(0, 0.85, 0);
      group.add(reactor);

      spinnerA = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.1, 10, 36), coreMat);
      spinnerA.rotation.x = Math.PI / 2;
      group.add(spinnerA);

      spinnerB = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.08, 10, 28), coreMat);
      spinnerB.position.y = 0.85;
      group.add(spinnerB);
    }

    // Windup telegraph ring (pulses visibly before enemy attacks)
    const windupRadius = kind === 'boss' ? 3.2 : kind === 'cruiser' ? 1.8 : 1.05;
    const windupRing = new THREE.Mesh(
      new THREE.TorusGeometry(windupRadius, 0.09, 8, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0,
      })
    );
    windupRing.rotation.x = Math.PI / 2;
    group.add(windupRing);

    // Soft radial contact shadow
    const shadowScale = kind === 'boss' ? 6.5 : kind === 'cruiser' ? 3.6 : 2.3;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(shadowScale, shadowScale), this.shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -PLAYER_Y + 0.03;
    group.add(shadow);

    this.scene.add(group);

    const diffMult = this.difficulty === 'ace' ? 1.35 : this.difficulty === 'recruit' ? 0.8 : 1.0;
    const baseHp = kind === 'boss' ? 280 : kind === 'cruiser' ? 65 : 24;
    const hp = Math.round(baseHp * diffMult);

    return {
      id: this.nextEnemyId++,
      kind,
      group,
      shadow,
      windupRing,
      partsWithEmissive: emissiveMats,
      pos: spawnPos.clone(),
      vel: new THREE.Vector3(),
      hp,
      maxHp: hp,
      radius: kind === 'boss' ? 2.6 : kind === 'cruiser' ? 1.45 : 0.95,
      speed: kind === 'boss' ? 4.4 : kind === 'cruiser' ? 5.6 : 10.2,
      scoreValue: kind === 'boss' ? 1200 : kind === 'cruiser' ? 260 : 100,
      hitFlashTimer: 0,
      fireCooldown: kind === 'scout' ? 2.4 + Math.random() : 1.5 + Math.random(),
      windupTimer: 0,
      isWindingUp: false,
      strafeSign: Math.random() > 0.5 ? 1 : -1,
      spinnerA,
      spinnerB,
    };
  }

  private spawnWave(waveNum: number): void {
    this.clearEnemies();
    const extraCount = Math.max(0, waveNum - 3) * 2;
    const scoutCount = (waveNum === 1 ? 5 : waveNum === 2 ? 7 : 6) + extraCount;
    const cruiserCount = waveNum === 1 ? 1 : waveNum === 2 ? 3 : 2 + Math.floor(extraCount / 2);

    const spawnAtRadius = (idx: number, total: number, rMin: number, rSpan: number): THREE.Vector3 => {
      const a = (idx / Math.max(1, total)) * Math.PI * 2 + Math.random() * 0.4;
      const r = rMin + Math.random() * rSpan;
      return new THREE.Vector3(Math.cos(a) * r, PLAYER_Y, Math.sin(a) * r);
    };

    for (let i = 0; i < scoutCount; i++) {
      this.enemies.push(this.createEnemyEntity('scout', spawnAtRadius(i, scoutCount, 22, 8)));
    }
    for (let i = 0; i < cruiserCount; i++) {
      this.enemies.push(this.createEnemyEntity('cruiser', spawnAtRadius(i, cruiserCount, 26, 6)));
    }
    if (waveNum >= 3) {
      this.enemies.push(this.createEnemyEntity('boss', new THREE.Vector3(0, PLAYER_Y, -28)));
    }
  }

  private clearEnemies(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
    }
    this.enemies = [];
  }

  private clearProjectiles(): void {
    for (const proj of this.projectiles) {
      proj.active = false;
      this.scene.remove(proj.mesh);
    }
    this.projectiles = [];
  }

  private spawnProjectile(
    origin: THREE.Vector3,
    dir: THREE.Vector3,
    fromPlayer: boolean,
    speed: number,
    damage: number
  ): void {
    const mesh = new THREE.Mesh(
      this.projectileGeo,
      fromPlayer ? this.playerBulletMat : this.enemyBulletMat
    );
    mesh.position.copy(origin);
    mesh.scale.setScalar(fromPlayer ? 1.0 : 1.35);
    this.scene.add(mesh);

    this.projectiles.push({
      active: true,
      fromPlayer,
      mesh,
      pos: origin.clone(),
      vel: dir.clone().normalize().multiplyScalar(speed),
      life: fromPlayer ? 1.55 : 3.2,
      damage,
      radius: fromPlayer ? 0.35 : 0.48,
    });
  }

  // Public Controls API for React Shell
  public startGame(difficulty: DifficultyMode = this.difficulty): void {
    this.difficulty = difficulty;
    this.score = 0;
    this.combo = 1;
    this.comboTimer = 0;
    this.wave = 1;
    this.endlessMode = false;
    this.kills = 0;
    this.maxShield = difficulty === 'recruit' ? 130 : difficulty === 'ace' ? 85 : 100;
    this.shield = this.maxShield;
    this.beaconIntegrity = 100;
    this.invulnTimer = 1.0;
    this.dashCooldown = 0;
    this.dashActiveTimer = 0;
    this.fireCooldown = 0;
    this.playerPos.set(0, PLAYER_Y, 14);
    this.playerVel.set(0, 0, 0);
    this.playerFacing.set(0, 0, -1);
    this.inspectCamera = false;
    this.controls.enabled = false;

    this.clearProjectiles();
    this.spawnWave(1);
    this.phase = 'playing';
    this.audio.playChime('wave');
    this.emitHud(true);
  }

  public continueEndless(): void {
    this.endlessMode = true;
    this.wave += 1;
    this.shield = Math.min(this.maxShield, this.shield + 40);
    this.beaconIntegrity = Math.min(100, this.beaconIntegrity + 25);
    this.clearProjectiles();
    this.spawnWave(this.wave);
    this.phase = 'playing';
    this.audio.playChime('wave');
    this.emitHud(true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      this.heldKeys.clear();
      this.pointerDown = false;
      this.controls.enabled = true;
      this.controls.target.copy(this.playerPos);
      this.emitHud(true);
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.controls.enabled = this.inspectCamera;
      this.emitHud(true);
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.clearProjectiles();
    this.clearEnemies();
    this.playerPos.set(0, PLAYER_Y, 13);
    this.playerVel.set(0, 0, 0);
    this.playerRoot.position.copy(this.playerPos);
    this.playerRoot.rotation.set(0, 0, 0);
    this.controls.enabled = this.inspectCamera;
    this.emitHud(true);
  }

  public setInspectCamera(enabled: boolean): void {
    this.inspectCamera = enabled;
    this.controls.enabled = enabled;
    if (enabled) {
      this.controls.target.set(0, 1.5, 0);
    }
    this.emitHud(true);
  }

  public setAtmosphere(atmo: SceneAtmosphere): void {
    this.atmosphere = atmo;
    const t = ATMOSPHERE_THEMES[atmo];
    this.scene.background = new THREE.Color(t.bgHex);
    this.fog.color.setHex(t.bgHex);
    this.fog.density = t.fogDensity;
    this.keyLight.color.setHex(t.keyColor);
    this.hemiLight.color.setHex(t.hemiSky);
    this.hemiLight.groundColor.setHex(t.hemiGround);
    this.beaconLight.color.setHex(t.beaconColor);
    this.beaconCrystalMat.color.setHex(t.beaconColor);
    this.beaconCrystalMat.emissive.setHex(t.beaconColor);
    this.emitHud(true);
  }

  public setAsteroidDensity(density: number): void {
    this.asteroidDensity = Math.max(0.15, Math.min(1, density));
    this.asteroidMesh.count = Math.floor(this.asteroidMetas.length * this.asteroidDensity);
    this.emitHud(true);
  }

  public setTouchMove(x: number, z: number): void {
    this.touchMoveVec.set(x, z);
  }

  public triggerTouchFire(): void {
    this.fireBufferTimer = 0.14;
  }

  public triggerTouchDash(): void {
    this.dashBufferTimer = 0.16;
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointerup', this.handlePointerUp);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.phase === 'playing' || this.phase === 'paused') {
        e.preventDefault();
        this.togglePause();
        return;
      }
    }

    if (this.phase === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      this.startGame(this.difficulty);
      return;
    }

    this.heldKeys.add(e.code);

    if (this.phase === 'playing') {
      if (e.code === 'Space') {
        e.preventDefault();
        this.fireBufferTimer = 0.14;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyE') {
        e.preventDefault();
        this.dashBufferTimer = 0.16;
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.heldKeys.delete(e.code);
  };

  private handleWindowBlur = (): void => {
    this.heldKeys.clear();
    this.pointerDown = false;
    this.touchMoveVec.set(0, 0);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointerNdc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    this.pointerNdc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.pointerHasMoved = true;
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (this.phase === 'playing' && !this.inspectCamera) {
      this.pointerDown = true;
      this.fireBufferTimer = 0.14;
    }
  };

  private handlePointerUp = (): void => {
    this.pointerDown = false;
  };

  private loop = (now: number): void => {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame(this.loop);

    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);

    this.elapsed += dt;
    this.updateEnvironment(dt);

    if (this.phase === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      } else {
        this.updatePlaying(dt);
      }
    } else if (this.phase === 'title') {
      this.updateTitleShowcase(dt);
    }

    this.updateParticles(dt);
    this.updateCamera(dt);

    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.08) {
      this.hudEmitAccum = 0;
      this.emitHud(false);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateEnvironment(dt: number): void {
    // Central beacon gyro rotation & crystal bobbing
    this.beaconCrystal.rotation.y += dt * 1.1;
    this.beaconCrystal.position.y = 3.25 + Math.sin(this.elapsed * 2.2) * 0.18;
    this.beaconRingOuter.rotation.y += dt * 0.7;
    this.beaconRingOuter.rotation.x = Math.sin(this.elapsed * 0.6) * 0.35;
    this.beaconRingInner.rotation.z -= dt * 1.25;
    this.beaconRingInner.rotation.x += dt * 0.45;

    // Instanced orbiting asteroids
    const activeCount = this.asteroidMesh.count;
    for (let i = 0; i < activeCount; i++) {
      const m = this.asteroidMetas[i];
      m.angle += m.speed * dt;
      this.scratchVecA.set(
        Math.cos(m.angle) * m.radius,
        m.y + Math.sin(this.elapsed * 0.9 + i) * 0.3,
        Math.sin(m.angle) * m.radius
      );
      this.scratchQuat.setFromEuler(
        new THREE.Euler(this.elapsed * m.spinX, this.elapsed * m.spinY, 0)
      );
      this.scratchScale.set(m.scale, m.scale * 0.82, m.scale);
      this.scratchMat.compose(this.scratchVecA, this.scratchQuat, this.scratchScale);
      this.asteroidMesh.setMatrixAt(i, this.scratchMat);
    }
    this.asteroidMesh.instanceMatrix.needsUpdate = true;
  }

  private updateTitleShowcase(dt: number): void {
    // Gentle hover on player ship during title screen
    this.playerPos.set(Math.sin(this.elapsed * 0.35) * 3.5, PLAYER_Y + Math.sin(this.elapsed * 2) * 0.18, 12);
    this.playerRoot.position.copy(this.playerPos);
    this.playerRoot.rotation.y = Math.sin(this.elapsed * 0.35) * 0.25;
    this.playerTilt.rotation.z = Math.cos(this.elapsed * 0.35) * -0.14;
    this.playerShadow.position.y = -this.playerPos.y + 0.03;
    this.playerThrusterMat.emissiveIntensity = 1.8 + Math.sin(this.elapsed * 8) * 0.45;
    this.playerShieldRing.rotation.z += dt * 0.5;
  }

  private updatePlaying(dt: number): void {
    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    if (this.invulnTimer > 0) {
      this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    }
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.fireBufferTimer > 0) this.fireBufferTimer = Math.max(0, this.fireBufferTimer - dt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.dashBufferTimer > 0) this.dashBufferTimer = Math.max(0, this.dashBufferTimer - dt);

    // Input axis (WASD + Arrows + Touch stick)
    let moveX = this.touchMoveVec.x;
    let moveZ = this.touchMoveVec.y;
    if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) moveX -= 1;
    if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) moveX += 1;
    if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) moveZ -= 1;
    if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) moveZ += 1;

    this.scratchVecA.set(moveX, 0, moveZ);
    if (this.scratchVecA.lengthSq() > 1) {
      this.scratchVecA.normalize();
    }

    // Trigger Dash (buffered)
    if (this.dashBufferTimer > 0 && this.dashCooldown <= 0) {
      this.dashBufferTimer = 0;
      this.dashCooldown = this.dashMaxCooldown;
      this.dashActiveTimer = 0.2;
      this.invulnTimer = Math.max(this.invulnTimer, 0.26);
      if (this.scratchVecA.lengthSq() > 0.05) {
        this.dashDir.copy(this.scratchVecA).normalize();
      } else {
        this.dashDir.copy(this.playerFacing).normalize();
      }
      this.audio.playDash();
      this.spawnParticles(this.playerPos, 14, 0x38bdf8, 12);
    }

    // Move Player
    if (this.dashActiveTimer > 0) {
      this.dashActiveTimer -= dt;
      this.playerVel.copy(this.dashDir).multiplyScalar(42);
      // Squash & stretch forward elongation
      this.playerTilt.scale.set(0.84, 0.9, 1.32);
    } else {
      const accel = 76;
      const maxSpeed = 18.5;
      this.playerVel.x += this.scratchVecA.x * accel * dt;
      this.playerVel.z += this.scratchVecA.z * accel * dt;
      // Exponential drag
      const drag = Math.exp(-5.6 * dt);
      this.playerVel.multiplyScalar(drag);
      if (this.playerVel.length() > maxSpeed) {
        this.playerVel.setLength(maxSpeed);
      }
      // Recover squash-and-stretch smoothly
      this.playerTilt.scale.lerp(this.scratchVecB.set(1, 1, 1), 1 - Math.exp(-14 * dt));
    }

    this.playerPos.addScaledVector(this.playerVel, dt);
    const distFromCenter = Math.hypot(this.playerPos.x, this.playerPos.z);
    if (distFromCenter > ARENA_BOUND - 1.5) {
      const scale = (ARENA_BOUND - 1.5) / distFromCenter;
      this.playerPos.x *= scale;
      this.playerPos.z *= scale;
    }
    // Avoid overlapping central beacon plinth
    if (distFromCenter < 3.8 && distFromCenter > 0.001) {
      const push = 3.8 / distFromCenter;
      this.playerPos.x *= push;
      this.playerPos.z *= push;
    }

    this.playerPos.y = PLAYER_Y + Math.sin(this.elapsed * 3.5) * 0.1;
    this.playerRoot.position.copy(this.playerPos);
    this.playerShadow.position.y = -this.playerPos.y + 0.03;

    // Facing Direction (Cursor raycast if moved & not orbit-inspecting, otherwise movement/nearest)
    if (this.pointerHasMoved && !this.inspectCamera) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      if (this.raycaster.ray.intersectPlane(this.combatPlane, this.scratchVecB)) {
        this.scratchVecB.sub(this.playerPos);
        this.scratchVecB.y = 0;
        if (this.scratchVecB.lengthSq() > 0.25) {
          this.playerFacing.lerp(this.scratchVecB.normalize(), 1 - Math.exp(-18 * dt)).normalize();
        }
      }
    } else if (this.scratchVecA.lengthSq() > 0.08) {
      this.playerFacing.lerp(this.scratchVecA.normalize(), 1 - Math.exp(-12 * dt)).normalize();
    }

    const yaw = Math.atan2(-this.playerFacing.x, -this.playerFacing.z);
    this.playerRoot.rotation.y = yaw;
    // Bank roll cleanly with lateral velocity
    const targetBank = THREE.MathUtils.clamp(-this.playerVel.x * 0.025, -0.38, 0.38);
    this.playerTilt.rotation.z = THREE.MathUtils.lerp(
      this.playerTilt.rotation.z,
      targetBank,
      1 - Math.exp(-10 * dt)
    );

    // Shield pulse & invuln blink
    const shieldMat = this.playerShieldRing.material as THREE.MeshBasicMaterial;
    shieldMat.opacity = this.invulnTimer > 0 ? 0.55 + Math.sin(this.elapsed * 28) * 0.3 : 0.22;
    this.playerShieldRing.rotation.z += dt * 1.1;
    this.playerThrusterMat.emissiveIntensity =
      this.dashActiveTimer > 0 ? 4.5 : 1.9 + this.playerVel.length() * 0.08;

    // Firing (held Space/Pointer or buffered tap)
    if ((this.heldKeys.has('Space') || this.pointerDown || this.fireBufferTimer > 0) && this.fireCooldown <= 0) {
      this.fireBufferTimer = 0;
      this.fireCooldown = 0.145;
      // Dual wing-barrel volley
      const right = this.scratchVecC.set(-this.playerFacing.z, 0, this.playerFacing.x).normalize();
      const leftOrigin = this.playerPos.clone().addScaledVector(this.playerFacing, 1.35).addScaledVector(right, -0.45);
      const rightOrigin = this.playerPos.clone().addScaledVector(this.playerFacing, 1.35).addScaledVector(right, 0.45);
      this.spawnProjectile(leftOrigin, this.playerFacing, true, 46, 12);
      this.spawnProjectile(rightOrigin, this.playerFacing, true, 46, 12);
      // Subtle recoil squash
      this.playerTilt.scale.set(1.06, 1.0, 0.92);
      this.audio.playLaser();
    }

    this.updateEnemies(dt);
    this.updateProjectiles(dt);

    // Wave clear progression
    if (this.enemies.length === 0) {
      if (!this.endlessMode && this.wave >= this.maxWaves) {
        this.phase = 'victory';
        this.audio.playChime('victory');
        this.emitHud(true);
      } else {
        this.wave += 1;
        this.shield = Math.min(this.maxShield, this.shield + 20);
        this.spawnWave(this.wave);
        this.audio.playChime('wave');
        this.emitHud(true);
      }
    }
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.spinnerA) e.spinnerA.rotation.z += dt * 1.4;
      if (e.spinnerB) e.spinnerB.rotation.y -= dt * 1.9;

      // Hit flash recovery
      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer -= dt;
        const flashFactor = e.hitFlashTimer > 0 ? 1 : 0;
        e.partsWithEmissive.forEach((m, idx) => {
          m.emissiveIntensity = flashFactor ? 4.0 : idx === 1 ? 1.5 : 0;
        });
      }

      // Direction toward player or central beacon
      const targetPos = e.kind === 'scout' && i % 2 === 1 ? this.beaconGroup.position : this.playerPos;
      this.scratchVecA.subVectors(targetPos, e.pos);
      this.scratchVecA.y = 0;
      const dist = Math.max(0.01, this.scratchVecA.length());
      this.scratchVecA.normalize();

      // Strafe perpendicular tangent for cruisers/bosses
      this.scratchVecB.set(-this.scratchVecA.z * e.strafeSign, 0, this.scratchVecA.x * e.strafeSign);
      const preferredDist = e.kind === 'boss' ? 15 : e.kind === 'cruiser' ? 12 : 1.5;

      if (dist > preferredDist) {
        e.vel.copy(this.scratchVecA).multiplyScalar(e.speed);
        if (e.kind !== 'scout') e.vel.addScaledVector(this.scratchVecB, e.speed * 0.45);
      } else {
        e.vel.copy(this.scratchVecB).multiplyScalar(e.speed * 0.85);
      }

      e.pos.addScaledVector(e.vel, dt);
      e.pos.y = PLAYER_Y + Math.sin(this.elapsed * 3 + e.id) * 0.14;
      e.group.position.copy(e.pos);
      e.shadow.position.y = -e.pos.y + 0.03;

      // Face player cleanly
      const yaw = Math.atan2(this.playerPos.x - e.pos.x, this.playerPos.z - e.pos.z);
      e.group.rotation.y = yaw;

      // Telegraph windup + Enemy ranged attack
      if (e.kind !== 'scout' || dist < 17) {
        if (e.isWindingUp) {
          e.windupTimer -= dt;
          const windupMat = e.windupRing.material as THREE.MeshBasicMaterial;
          const duration = e.kind === 'boss' ? 0.85 : 0.65;
          const progress = 1 - Math.max(0, e.windupTimer) / duration;
          windupMat.opacity = 0.25 + progress * 0.75;
          e.windupRing.scale.setScalar(1.25 - progress * 0.45);

          if (e.windupTimer <= 0) {
            e.isWindingUp = false;
            windupMat.opacity = 0;
            e.fireCooldown = e.kind === 'boss' ? 1.55 : e.kind === 'cruiser' ? 2.1 : 2.6;

            const aimDir = this.scratchVecC.subVectors(this.playerPos, e.pos).setY(0).normalize();
            if (e.kind === 'boss') {
              [-0.26, 0, 0.26].forEach((offsetAngle) => {
                const cos = Math.cos(offsetAngle);
                const sin = Math.sin(offsetAngle);
                const spread = new THREE.Vector3(
                  aimDir.x * cos - aimDir.z * sin,
                  0,
                  aimDir.x * sin + aimDir.z * cos
                );
                this.spawnProjectile(e.pos, spread, false, 18.5, 16);
              });
            } else {
              this.spawnProjectile(e.pos, aimDir, false, 16, e.kind === 'cruiser' ? 14 : 10);
            }
          }
        } else {
          e.fireCooldown -= dt;
          if (e.fireCooldown <= 0) {
            e.isWindingUp = true;
            e.windupTimer = e.kind === 'boss' ? 0.85 : e.kind === 'cruiser' ? 0.65 : 0.45;
          }
        }
      }

      // Collision with Player
      if (e.pos.distanceTo(this.playerPos) < e.radius + 1.05) {
        this.damagePlayer(e.kind === 'boss' ? 24 : 15);
        // Knockback enemy slightly
        this.scratchVecA.subVectors(e.pos, this.playerPos).setY(0).normalize();
        e.pos.addScaledVector(this.scratchVecA, 2.5);
      }

      // Collision with Central Beacon
      if (Math.hypot(e.pos.x, e.pos.z) < e.radius + 2.1) {
        this.beaconIntegrity = Math.max(0, this.beaconIntegrity - 14);
        this.shakeIntensity = Math.max(this.shakeIntensity, 0.55);
        this.audio.playShieldImpact();
        this.spawnParticles(e.pos, 16, 0xf59e0b, 10);
        this.scene.remove(e.group);
        this.enemies.splice(i, 1);
        if (this.beaconIntegrity <= 0) {
          this.triggerGameOver();
          return;
        }
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      let remove = p.life <= 0 || Math.hypot(p.pos.x, p.pos.z) > ARENA_BOUND + 5;

      if (!remove && p.fromPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (p.pos.distanceTo(e.pos) < e.radius + p.radius) {
            e.hp -= p.damage;
            e.hitFlashTimer = 0.08;
            remove = true;
            this.spawnParticles(p.pos, 6, 0x38bdf8, 8);
            this.audio.playEnemyHit();

            if (e.hp <= 0) {
              const heavy = e.kind !== 'scout';
              this.kills += 1;
              this.combo = Math.min(8, this.combo + 1);
              this.comboTimer = 4.2;
              this.score += e.scoreValue * this.combo;
              this.hitstopTimer = heavy ? 0.055 : 0.025;
              this.shakeIntensity = Math.max(this.shakeIntensity, heavy ? 0.72 : 0.32);
              this.spawnParticles(
                e.pos,
                heavy ? 24 : 14,
                e.kind === 'boss' ? 0xf43f5e : 0xfbbf24,
                heavy ? 16 : 11
              );
              this.audio.playExplosion(heavy);
              this.scene.remove(e.group);
              this.enemies.splice(j, 1);
            }
            break;
          }
        }
      } else if (!remove && !p.fromPlayer) {
        if (p.pos.distanceTo(this.playerPos) < 1.15 + p.radius) {
          this.damagePlayer(p.damage);
          remove = true;
        }
      }

      if (remove) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private damagePlayer(amount: number): void {
    if (this.invulnTimer > 0 || this.phase !== 'playing') return;
    this.invulnTimer = 0.65;
    this.shield = Math.max(0, this.shield - amount);
    this.combo = 1;
    this.hitstopTimer = 0.045;
    this.shakeIntensity = Math.max(this.shakeIntensity, 0.75);
    this.spawnParticles(this.playerPos, 14, 0xfb7185, 11);
    this.audio.playShieldImpact();

    if (this.shield <= 0) {
      this.triggerGameOver();
    } else {
      this.emitHud(true);
    }
  }

  private triggerGameOver(): void {
    this.phase = 'gameover';
    this.heldKeys.clear();
    this.pointerDown = false;
    this.spawnParticles(this.playerPos, 28, 0xf43f5e, 15);
    this.audio.playChime('gameover');
    this.emitHud(true);
  }

  private updateParticles(dt: number): void {
    let anyActive = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyActive = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.scratchMat.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, this.scratchMat);
        continue;
      }
      p.vel.multiplyScalar(Math.exp(-3.5 * dt));
      p.pos.addScaledVector(p.vel, dt);
      const s = p.scale * (p.life / p.maxLife);
      this.scratchScale.set(s, s, s);
      this.scratchQuat.setFromEuler(new THREE.Euler(this.elapsed * 4 + i, this.elapsed * 3, 0));
      this.scratchMat.compose(p.pos, this.scratchQuat, this.scratchScale);
      this.particleMesh.setMatrixAt(i, this.scratchMat);
    }
    if (anyActive) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateCamera(dt: number): void {
    if (this.inspectCamera || this.phase === 'paused') {
      this.controls.update();
      return;
    }

    if (this.phase === 'title') {
      const angle = this.elapsed * 0.16;
      const desiredX = Math.sin(angle) * 24;
      const desiredZ = Math.cos(angle) * 24;
      this.scratchVecA.set(desiredX, 11.5, desiredZ);
      this.camera.position.lerp(this.scratchVecA, 1 - Math.exp(-3.5 * dt));
      this.camera.lookAt(0, 2.2, 2);
      return;
    }

    // Damped third-person tactical chase camera + decaying impact shake
    this.scratchVecA.set(
      this.playerPos.x * 0.72,
      20.5,
      this.playerPos.z * 0.72 + 19.5
    );
    this.camera.position.lerp(this.scratchVecA, 1 - Math.exp(-7.5 * dt));

    if (this.shakeIntensity > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 1.4;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 1.1;
      this.shakeIntensity *= Math.exp(-10 * dt);
    } else {
      this.shakeIntensity = 0;
    }

    this.scratchVecB.set(this.playerPos.x * 0.45, 1.2, this.playerPos.z * 0.45);
    this.camera.lookAt(this.scratchVecB);
  }

  private emitHud(force: boolean): void {
    if (!force && this.disposed) return;
    const boss = this.enemies.find((e) => e.kind === 'boss');
    this.onHudUpdate({
      phase: this.phase,
      score: this.score,
      combo: this.combo,
      wave: this.wave,
      maxWaves: this.maxWaves,
      endlessMode: this.endlessMode,
      shield: Math.round(this.shield),
      maxShield: this.maxShield,
      beaconIntegrity: Math.round(this.beaconIntegrity),
      dashReadyRatio: 1 - Math.min(1, this.dashCooldown / this.dashMaxCooldown),
      enemiesRemaining: this.enemies.length,
      kills: this.kills,
      inspectCamera: this.inspectCamera,
      atmosphere: this.atmosphere,
      asteroidDensity: this.asteroidDensity,
      difficulty: this.difficulty,
      bossHpRatio: boss ? Math.max(0, boss.hp / boss.maxHp) : null,
      bossName: boss ? 'KRONOS-X DREADNOUGHT' : null,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointerup', this.handlePointerUp);

    this.controls.dispose();
    this.clearEnemies();
    this.clearProjectiles();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) {
        (obj as THREE.Mesh).geometry.dispose();
      }
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else if (mat) {
        mat.dispose();
      }
    });

    this.shadowTex.dispose();
    this.deckTextures.map.dispose();
    this.deckTextures.bumpMap.dispose();
    this.deckTextures.roughnessMap.dispose();
    this.envRenderTarget.dispose();
    this.pmremGenerator.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
