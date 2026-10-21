import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BoardTheme, Move, PieceType, PlayerRole } from '../types';
import { getTrappedTigersInfo } from '../game/rules';

export interface ThreeBaghchalBoardProps {
  board: PieceType[];
  turn: PlayerRole;
  phase: 'placement' | 'movement';
  goatsInReserve: number;
  selectedPos: number | null;
  validMoves: Move[];
  lastMove: Move | null;
  isInteractive: boolean;
  onNodeClick: (pos: number) => void;
  isAiThinking?: boolean;
  theme?: BoardTheme;
}

export const ThreeBaghchalBoard: React.FC<ThreeBaghchalBoardProps> = ({
  board,
  turn,
  phase,
  goatsInReserve,
  selectedPos,
  validMoves,
  lastMove,
  isInteractive,
  onNodeClick,
  isAiThinking,
  theme = 'stone',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const pieceMeshesRef = useRef<{ [index: number]: THREE.Group }>({});
  const highlightsRef = useRef<THREE.Mesh[]>([]);
  const trailLineRef = useRef<THREE.Line | null>(null);

  const targetCamPos = useRef(new THREE.Vector3(0, 13, 11));
  const targetCamLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const [cameraView, setCameraView] = useState<'cinematic' | 'top'>('cinematic');

  // Keep latest interactive callbacks in ref for pointer raycaster
  const propsRef = useRef({ board, isInteractive, onNodeClick, selectedPos, validMoves, theme });
  useEffect(() => {
    propsRef.current = { board, isInteractive, onNodeClick, selectedPos, validMoves, theme };
  });

  const trappedInfo = useMemo(() => getTrappedTigersInfo(board), [board]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    const bgColors: Record<BoardTheme, number> = {
      stone: 0x0c0e14,
      cathedral3d: 0x090a0f,
      slate: 0x090d16,
      classic: 0x120e0a,
      midnight: 0x07040d,
    };
    const currentBg = bgColors[theme] || 0x0c0e14;
    scene.background = new THREE.Color(currentBg);
    scene.fog = new THREE.FogExp2(currentBg, 0.032);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 13, 11);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 6;
    controls.maxDistance = 24;
    controlsRef.current = controls;

    // 5. Build Environment & Board with Engraved Stone Textures
    const envCleanup = buildEnvironment(scene, theme);
    const { textures, cleanup: boardCleanup } = buildBaghchalBoard3D(scene, theme);

    // 6. Raycasting for piece/node selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (const hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== scene && obj.userData?.nodeIndex === undefined) {
          obj = obj.parent;
        }

        if (obj && typeof obj.userData?.nodeIndex === 'number') {
          const idx = obj.userData.nodeIndex;
          const { isInteractive, onNodeClick } = propsRef.current;
          if (isInteractive) {
            onNodeClick(idx);
          }
          break;
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', handlePointerDown);

    // 7. Animation Loop
    let animationFrameId: number;
    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth camera interpolation
      camera.position.lerp(targetCamPos.current, 0.06);
      controls.target.lerp(targetCamLookAt.current, 0.06);
      controls.update();

      // Idle breathing for pieces
      const t = time * 0.003;
      Object.keys(pieceMeshesRef.current).forEach((key, i) => {
        const idx = Number(key);
        const mesh = pieceMeshesRef.current[idx];
        if (mesh && !mesh.userData.isAnimating) {
          const isSelected = propsRef.current.selectedPos === idx;
          const basePosY = isSelected ? 0.42 : 0.08;
          mesh.position.y = basePosY + Math.sin(t + i * 0.6) * 0.025;
        }
      });

      renderer.render(scene, camera);
    };
    animate(performance.now());

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      domEl.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animationFrameId);
      envCleanup();
      boardCleanup();
      textures.diffuse.dispose();
      textures.bump.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [theme]);

  // Update 3D Pieces and Highlights when board, selection, or valid moves change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old pieces
    Object.values(pieceMeshesRef.current).forEach((mesh) => scene.remove(mesh));
    pieceMeshesRef.current = {};

    // Render current board pieces
    board.forEach((pieceType, idx) => {
      if (pieceType) {
        const isTrapped = pieceType === 'tiger' && trappedInfo.trappedIndices.includes(idx);
        const mesh = pieceType === 'tiger' ? createTigerMesh(isTrapped, theme) : createGoatMesh(theme);
        const r = Math.floor(idx / 5);
        const c = idx % 5;
        const wx = (c - 2) * 1.8;
        const wz = (r - 2) * 1.8;
        const isSelected = selectedPos === idx;

        mesh.position.set(wx, isSelected ? 0.42 : 0.08, wz);
        mesh.userData = { nodeIndex: idx, pieceType };
        scene.add(mesh);
        pieceMeshesRef.current[idx] = mesh;
      }
    });

    // Update Highlights for valid moves & selection
    highlightsRef.current.forEach((h) => scene.remove(h));
    highlightsRef.current = [];

    const ringGeo = new THREE.RingGeometry(0.28, 0.44, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });

    validMoves.forEach((vm) => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const r = Math.floor(vm.to / 5);
      const c = vm.to % 5;
      ring.position.set((c - 2) * 1.8, 0.12, (r - 2) * 1.8);
      ring.userData = { nodeIndex: vm.to };
      scene.add(ring);
      highlightsRef.current.push(ring);
    });

    if (selectedPos !== null) {
      const selRing = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
      );
      const r = Math.floor(selectedPos / 5);
      const c = selectedPos % 5;
      selRing.position.set((c - 2) * 1.8, 0.13, (r - 2) * 1.8);
      selRing.userData = { nodeIndex: selectedPos };
      scene.add(selRing);
      highlightsRef.current.push(selRing);
    }

    // Last Move Trail Line
    if (trailLineRef.current) {
      scene.remove(trailLineRef.current);
      trailLineRef.current = null;
    }

    if (lastMove && lastMove.from !== undefined) {
      const fr = Math.floor(lastMove.from / 5);
      const fc = lastMove.from % 5;
      const tr = Math.floor(lastMove.to / 5);
      const tc = lastMove.to % 5;

      const p1 = new THREE.Vector3((fc - 2) * 1.8, 0.14, (fr - 2) * 1.8);
      const p2 = new THREE.Vector3((tc - 2) * 1.8, 0.14, (tr - 2) * 1.8);

      const trailGeo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      const trailMat = new THREE.LineDashedMaterial({
        color: 0xf59e0b,
        dashSize: 0.4,
        gapSize: 0.2,
        linewidth: 2,
        transparent: true,
        opacity: 0.85,
      });

      const trailLine = new THREE.Line(trailGeo, trailMat);
      trailLine.computeLineDistances();
      scene.add(trailLine);
      trailLineRef.current = trailLine;
    }
  }, [board, selectedPos, validMoves, lastMove, trappedInfo, theme]);

  const handleCameraChange = (view: 'cinematic' | 'top') => {
    setCameraView(view);
    if (view === 'top') {
      targetCamPos.current.set(0, 16, 0.01);
      targetCamLookAt.current.set(0, 0, 0);
    } else {
      targetCamPos.current.set(0, 13, 11);
      targetCamLookAt.current.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center select-none overflow-hidden rounded-2xl border border-stone-800 bg-stone-950">
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Camera View Toggle HUD */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-stone-900/90 backdrop-blur-md p-1 rounded-xl border border-stone-750 shadow-xl">
        <button
          onClick={() => handleCameraChange('cinematic')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
            cameraView === 'cinematic'
              ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          Cinematic
        </button>
        <button
          onClick={() => handleCameraChange('top')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
            cameraView === 'top'
              ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
              : 'text-stone-300 hover:text-white'
          }`}
        >
          Top-Down
        </button>
      </div>

      {/* AI Thinking Floating Badge */}
      {isAiThinking && (
        <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 backdrop-blur-md animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>AI computing strategic move...</span>
        </div>
      )}
    </div>
  );
};

/* --- PROCEDURAL HIGH-RESOLUTION STONE TEXTURE GENERATOR --- */

function generateStoneBoardTextures(theme: BoardTheme): { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const SIZE = 1024;
  const MARGIN = 102.4; // 10% outer border
  const STEP = (SIZE - 2 * MARGIN) / 4; // 204.8 px per board cell

  // 1. Create Diffuse Canvas
  const diffCanvas = document.createElement('canvas');
  diffCanvas.width = SIZE;
  diffCanvas.height = SIZE;
  const diffCtx = diffCanvas.getContext('2d')!;

  // 2. Create Bump Canvas (grayscale heightmap)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = SIZE;
  bumpCanvas.height = SIZE;
  const bumpCtx = bumpCanvas.getContext('2d')!;

  // Base Colors Configuration per theme
  const palette = {
    stone: {
      bg: '#1c1f26',
      stipples: ['#121418', '#252932', '#2f3440', '#3b4252'],
      borderOuter: '#2b303c',
      borderInner: '#13151a',
      shadowGroove: 'rgba(5, 6, 8, 0.95)',
      bevelHighlight: 'rgba(255, 255, 255, 0.28)',
      innerIncision: '#94a3b8',
      socketInner: '#0e1014',
      socketBevel: '#475569',
    },
    cathedral3d: {
      bg: '#121319',
      stipples: ['#090a0d', '#1b1d26', '#262835'],
      borderOuter: '#4f378b',
      borderInner: '#0a0b10',
      shadowGroove: 'rgba(3, 4, 6, 0.95)',
      bevelHighlight: 'rgba(208, 188, 255, 0.35)',
      innerIncision: '#d0bcff',
      socketInner: '#0c0d12',
      socketBevel: '#6b21a8',
    },
    slate: {
      bg: '#0d121c',
      stipples: ['#06080e', '#161e2e', '#1e293b'],
      borderOuter: '#0284c7',
      borderInner: '#05080e',
      shadowGroove: 'rgba(2, 6, 12, 0.95)',
      bevelHighlight: 'rgba(56, 189, 248, 0.3)',
      innerIncision: '#38bdf8',
      socketInner: '#080c14',
      socketBevel: '#0369a1',
    },
    classic: {
      bg: '#231812',
      stipples: ['#150e0b', '#2c1e16', '#3b281e'],
      borderOuter: '#b45309',
      borderInner: '#120b08',
      shadowGroove: 'rgba(10, 6, 4, 0.95)',
      bevelHighlight: 'rgba(254, 240, 138, 0.35)',
      innerIncision: '#f59e0b',
      socketInner: '#120b08',
      socketBevel: '#d97706',
    },
    midnight: {
      bg: '#090514',
      stipples: ['#030107', '#140827', '#1f0d3d'],
      borderOuter: '#9333ea',
      borderInner: '#030107',
      shadowGroove: 'rgba(2, 0, 5, 0.95)',
      bevelHighlight: 'rgba(192, 132, 252, 0.3)',
      innerIncision: '#c084fc',
      socketInner: '#04010a',
      socketBevel: '#a855f7',
    },
  }[theme] || {
    bg: '#1c1f26',
    stipples: ['#121418', '#252932', '#2f3440'],
    borderOuter: '#2b303c',
    borderInner: '#13151a',
    shadowGroove: 'rgba(5, 6, 8, 0.95)',
    bevelHighlight: 'rgba(255, 255, 255, 0.28)',
    innerIncision: '#94a3b8',
    socketInner: '#0e1014',
    socketBevel: '#475569',
  };

  // 1. Draw Diffuse Base Surface with Granite/Slate Noise
  diffCtx.fillStyle = palette.bg;
  diffCtx.fillRect(0, 0, SIZE, SIZE);

  // Deterministic seed noise to avoid jitter
  let seed = 42;
  const pseudoRandom = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Fine granite / slate flecks
  for (let i = 0; i < 4000; i++) {
    const nx = pseudoRandom() * SIZE;
    const ny = pseudoRandom() * SIZE;
    const rad = 0.5 + pseudoRandom() * 1.8;
    const colorIndex = Math.floor(pseudoRandom() * palette.stipples.length);
    diffCtx.fillStyle = palette.stipples[colorIndex];
    diffCtx.beginPath();
    diffCtx.arc(nx, ny, rad, 0, Math.PI * 2);
    diffCtx.fill();
  }

  // 2. Draw Bump Map Base Surface (Neutral Gray 128 + Micro-Noise)
  bumpCtx.fillStyle = 'rgb(128, 128, 128)';
  bumpCtx.fillRect(0, 0, SIZE, SIZE);

  for (let i = 0; i < 3000; i++) {
    const nx = pseudoRandom() * SIZE;
    const ny = pseudoRandom() * SIZE;
    const rad = 0.5 + pseudoRandom() * 1.5;
    const val = Math.floor(118 + pseudoRandom() * 20); // 118..138
    bumpCtx.fillStyle = `rgb(${val}, ${val}, ${val})`;
    bumpCtx.beginPath();
    bumpCtx.arc(nx, ny, rad, 0, Math.PI * 2);
    bumpCtx.fill();
  }

  // 3. Carved Border Relief on the perimeter
  diffCtx.strokeStyle = palette.borderInner;
  diffCtx.lineWidth = 14;
  diffCtx.strokeRect(36, 36, SIZE - 72, SIZE - 72);

  diffCtx.strokeStyle = palette.borderOuter;
  diffCtx.lineWidth = 4;
  diffCtx.strokeRect(46, 46, SIZE - 92, SIZE - 92);

  // Bump border: raised outer bevel (light) + carved groove (dark)
  bumpCtx.strokeStyle = 'rgb(80, 80, 80)';
  bumpCtx.lineWidth = 12;
  bumpCtx.strokeRect(36, 36, SIZE - 72, SIZE - 72);

  bumpCtx.strokeStyle = 'rgb(170, 170, 170)';
  bumpCtx.lineWidth = 4;
  bumpCtx.strokeRect(46, 46, SIZE - 92, SIZE - 92);

  // 4. Lines Definition: Baghchal Orthogonal + Diagonals
  const segments: [number, number, number, number][] = [];

  // Orthogonal grid lines
  for (let i = 0; i < 5; i++) {
    const coord = MARGIN + i * STEP;
    // Horizontal
    segments.push([MARGIN, coord, SIZE - MARGIN, coord]);
    // Vertical
    segments.push([coord, MARGIN, coord, SIZE - MARGIN]);
  }

  // Main Diagonals
  segments.push([MARGIN, MARGIN, SIZE - MARGIN, SIZE - MARGIN]);
  segments.push([SIZE - MARGIN, MARGIN, MARGIN, SIZE - MARGIN]);

  // Diamond Sides
  const mid = MARGIN + 2 * STEP;
  segments.push([mid, MARGIN, MARGIN, mid]);
  segments.push([MARGIN, mid, mid, SIZE - MARGIN]);
  segments.push([mid, SIZE - MARGIN, SIZE - MARGIN, mid]);
  segments.push([SIZE - MARGIN, mid, mid, MARGIN]);

  // DRAW MULTI-PASS ENGRAVED LINES ON DIFFUSE & BUMP CANVASES

  // --- PASS 1: Sunlit Bevel Highlight (Catching light from top-left) ---
  diffCtx.save();
  diffCtx.strokeStyle = palette.bevelHighlight;
  diffCtx.lineWidth = 6;
  diffCtx.lineCap = 'round';
  diffCtx.translate(-2, -2);
  segments.forEach(([x1, y1, x2, y2]) => {
    diffCtx.beginPath();
    diffCtx.moveTo(x1, y1);
    diffCtx.lineTo(x2, y2);
    diffCtx.stroke();
  });
  diffCtx.restore();

  // Bump Pass 1: Raised chiseled bevel ridge (bright)
  bumpCtx.save();
  bumpCtx.strokeStyle = 'rgb(185, 185, 185)';
  bumpCtx.lineWidth = 5;
  bumpCtx.lineCap = 'round';
  bumpCtx.translate(-2, -2);
  segments.forEach(([x1, y1, x2, y2]) => {
    bumpCtx.beginPath();
    bumpCtx.moveTo(x1, y1);
    bumpCtx.lineTo(x2, y2);
    bumpCtx.stroke();
  });
  bumpCtx.restore();

  // --- PASS 2: Deep Cast Shadow Trench (Groove shadow down-right) ---
  diffCtx.save();
  diffCtx.strokeStyle = palette.shadowGroove;
  diffCtx.lineWidth = 8;
  diffCtx.lineCap = 'round';
  diffCtx.translate(2.5, 2.5);
  segments.forEach(([x1, y1, x2, y2]) => {
    diffCtx.beginPath();
    diffCtx.moveTo(x1, y1);
    diffCtx.lineTo(x2, y2);
    diffCtx.stroke();
  });
  diffCtx.restore();

  // Bump Pass 2: Deep recessed carved trench (dark depression in heightmap)
  bumpCtx.save();
  bumpCtx.strokeStyle = 'rgb(24, 24, 24)';
  bumpCtx.lineWidth = 8;
  bumpCtx.lineCap = 'round';
  bumpCtx.translate(1, 1);
  segments.forEach(([x1, y1, x2, y2]) => {
    bumpCtx.beginPath();
    bumpCtx.moveTo(x1, y1);
    bumpCtx.lineTo(x2, y2);
    bumpCtx.stroke();
  });
  bumpCtx.restore();

  // --- PASS 3: Core Deep Carved Channel ---
  diffCtx.strokeStyle = palette.shadowGroove;
  diffCtx.lineWidth = 4.5;
  diffCtx.lineCap = 'round';
  segments.forEach(([x1, y1, x2, y2]) => {
    diffCtx.beginPath();
    diffCtx.moveTo(x1, y1);
    diffCtx.lineTo(x2, y2);
    diffCtx.stroke();
  });

  bumpCtx.strokeStyle = 'rgb(10, 10, 10)';
  bumpCtx.lineWidth = 4;
  bumpCtx.lineCap = 'round';
  segments.forEach(([x1, y1, x2, y2]) => {
    bumpCtx.beginPath();
    bumpCtx.moveTo(x1, y1);
    bumpCtx.lineTo(x2, y2);
    bumpCtx.stroke();
  });

  // --- PASS 4: Inner Accent Incision Line (Crisp stone / metal core) ---
  diffCtx.strokeStyle = palette.innerIncision;
  diffCtx.lineWidth = 2;
  diffCtx.lineCap = 'round';
  segments.forEach(([x1, y1, x2, y2]) => {
    diffCtx.beginPath();
    diffCtx.moveTo(x1, y1);
    diffCtx.lineTo(x2, y2);
    diffCtx.stroke();
  });

  // 5. DRAW 25 INTERSECTION CARVED SOCKETS / CUPS
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cx = MARGIN + c * STEP;
      const cy = MARGIN + r * STEP;

      // Diffuse socket: Outer shadow
      const outerGrad = diffCtx.createRadialGradient(cx, cy, 14, cx, cy, 26);
      outerGrad.addColorStop(0, 'transparent');
      outerGrad.addColorStop(1, 'rgba(5, 6, 8, 0.7)');
      diffCtx.fillStyle = outerGrad;
      diffCtx.beginPath();
      diffCtx.arc(cx, cy, 26, 0, Math.PI * 2);
      diffCtx.fill();

      // Diffuse socket: Sunken inner stone cup
      const cupGrad = diffCtx.createRadialGradient(cx - 2, cy - 2, 2, cx, cy, 18);
      cupGrad.addColorStop(0, palette.socketInner);
      cupGrad.addColorStop(0.8, palette.socketBevel);
      cupGrad.addColorStop(1, palette.borderInner);
      diffCtx.fillStyle = cupGrad;
      diffCtx.beginPath();
      diffCtx.arc(cx, cy, 18, 0, Math.PI * 2);
      diffCtx.fill();

      // Diffuse socket: Top-left highlight catch
      diffCtx.strokeStyle = palette.bevelHighlight;
      diffCtx.lineWidth = 2;
      diffCtx.beginPath();
      diffCtx.arc(cx, cy, 18, Math.PI, Math.PI * 1.6);
      diffCtx.stroke();

      // Bump Socket: Deep indentation pit (15) with raised lip (175)
      const bumpGrad = bumpCtx.createRadialGradient(cx, cy, 2, cx, cy, 22);
      bumpGrad.addColorStop(0, 'rgb(12, 12, 12)');
      bumpGrad.addColorStop(0.65, 'rgb(24, 24, 24)');
      bumpGrad.addColorStop(0.85, 'rgb(180, 180, 180)');
      bumpGrad.addColorStop(1, 'rgb(128, 128, 128)');
      bumpCtx.fillStyle = bumpGrad;
      bumpCtx.beginPath();
      bumpCtx.arc(cx, cy, 22, 0, Math.PI * 2);
      bumpCtx.fill();
    }
  }

  // Create Three.js Textures
  const diffuseTex = new THREE.CanvasTexture(diffCanvas);
  diffuseTex.wrapS = THREE.ClampToEdgeWrapping;
  diffuseTex.wrapT = THREE.ClampToEdgeWrapping;

  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.wrapS = THREE.ClampToEdgeWrapping;
  bumpTex.wrapT = THREE.ClampToEdgeWrapping;

  return { diffuse: diffuseTex, bump: bumpTex };
}

/* --- ENVIRONMENT & LIGHTING BUILDER --- */

function buildEnvironment(scene: THREE.Scene, theme: BoardTheme): () => void {
  const disposables: (THREE.Object3D | THREE.Light)[] = [];

  // Theme-specific lighting and altar
  if (theme === 'cathedral3d') {
    // Gothic Cathedral Sanctuary
    const ambientLight = new THREE.AmbientLight(0x282c37, 1.8);
    scene.add(ambientLight);
    disposables.push(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xdbeafe, 2.2);
    dirLight.position.set(12, 22, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);
    disposables.push(dirLight);

    const purpleLight = new THREE.PointLight(0x9333ea, 3.2, 35);
    purpleLight.position.set(-14, 10, -10);
    scene.add(purpleLight);
    disposables.push(purpleLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 3.2, 35);
    cyanLight.position.set(14, 10, 10);
    scene.add(cyanLight);
    disposables.push(cyanLight);

    // Altar Table
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x1b1c24, roughness: 0.7, metalness: 0.3 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 10), tableMat);
    table.position.y = -0.5;
    table.castShadow = true;
    table.receiveShadow = true;
    scene.add(table);
    disposables.push(table);

    // Gothic Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.7, 0.8, 16, 8);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e1f28, roughness: 0.9 });
    [-12, 12].forEach((x) => {
      [-12, 12].forEach((z) => {
        const pillar = new THREE.Mesh(pillarGeo, pillarMat);
        pillar.position.set(x, 7.5, z);
        pillar.castShadow = true;
        scene.add(pillar);
        disposables.push(pillar);
      });
    });
  } else {
    // Ancient Himalayan Stone Sanctuary (Default & Stone/Slate/Classic/Midnight)
    const ambientLight = new THREE.AmbientLight(theme === 'classic' ? 0x3d2b1f : 0x1e2430, 1.8);
    scene.add(ambientLight);
    disposables.push(ambientLight);

    // Warm Sunlit Directional Light
    const dirLight = new THREE.DirectionalLight(theme === 'classic' ? 0xfef3c7 : 0xfff7ed, 2.4);
    dirLight.position.set(12, 22, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);
    disposables.push(dirLight);

    // Himalayan Sky Bounce Light
    const skyLight = new THREE.PointLight(theme === 'slate' ? 0x38bdf8 : theme === 'midnight' ? 0xa855f7 : 0x60a5fa, 2.0, 35);
    skyLight.position.set(-14, 10, -10);
    scene.add(skyLight);
    disposables.push(skyLight);

    // Ground Courtyard Bounce Light
    const warmBounce = new THREE.PointLight(0xf59e0b, 1.6, 35);
    warmBounce.position.set(14, 8, 10);
    scene.add(warmBounce);
    disposables.push(warmBounce);

    // Solid Granite Altar Pedestal
    const altarColor = theme === 'classic' ? 0x2b1d16 : 0x161820;
    const altarMat = new THREE.MeshStandardMaterial({ color: altarColor, roughness: 0.85, metalness: 0.1 });
    const altar = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.8, 10.2), altarMat);
    altar.position.y = -0.5;
    altar.castShadow = true;
    altar.receiveShadow = true;
    scene.add(altar);
    disposables.push(altar);
  }

  // Ancient Temple Flagstone Floor
  const floorGeo = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0f1116, roughness: 0.9, metalness: 0.1 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.52;
  floor.receiveShadow = true;
  scene.add(floor);
  disposables.push(floor);

  return () => {
    disposables.forEach((obj) => {
      scene.remove(obj);
      if ('geometry' in obj) (obj as THREE.Mesh).geometry.dispose();
      if ('material' in obj) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  };
}

/* --- 3D BAGHCHAL BOARD WITH ENGRAVED CHISELED STONE SLAB --- */

function buildBaghchalBoard3D(
  scene: THREE.Scene,
  theme: BoardTheme
): { textures: { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture }; cleanup: () => void } {
  const disposables: THREE.Object3D[] = [];

  // 1. Generate High-Res Procedural Diffuse & Bump Textures
  const textures = generateStoneBoardTextures(theme);

  // 2. Heavy Stone Board Base Slab (Dark Granite / Slate rim)
  const slabGeo = new THREE.BoxGeometry(9.1, 0.35, 9.1);
  const slabColor = theme === 'classic' ? 0x1b110b : 0x14171e;
  const slabMat = new THREE.MeshStandardMaterial({ color: slabColor, roughness: 0.75, metalness: 0.2 });
  const slabMesh = new THREE.Mesh(slabGeo, slabMat);
  slabMesh.position.y = -0.08;
  slabMesh.receiveShadow = true;
  scene.add(slabMesh);
  disposables.push(slabMesh);

  // 3. Top Face: Bump-Mapped Engraved Chiseled Stone Plate
  const plateGeo = new THREE.PlaneGeometry(9.0, 9.0);
  const plateMat = new THREE.MeshStandardMaterial({
    map: textures.diffuse,
    bumpMap: textures.bump,
    bumpScale: theme === 'stone' || theme === 'slate' ? 0.22 : 0.14,
    roughness: theme === 'stone' ? 0.68 : 0.45,
    metalness: theme === 'cathedral3d' || theme === 'classic' ? 0.35 : 0.15,
  });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.rotation.x = -Math.PI / 2;
  plateMesh.position.y = 0.098;
  plateMesh.receiveShadow = true;
  scene.add(plateMesh);
  disposables.push(plateMesh);

  // 4. Inset Chiseled Edge Border Trim
  const trimGeo = new THREE.BoxGeometry(9.16, 0.06, 9.16);
  const trimColor = theme === 'classic' ? 0xb45309 : theme === 'cathedral3d' ? 0x4f378b : 0x334155;
  const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.4, metalness: 0.6 });
  const trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.position.y = 0.085;
  scene.add(trimMesh);
  disposables.push(trimMesh);

  // 5. 25 Intersection Sockets & Hit Targets
  const socketGeo = new THREE.CylinderGeometry(0.24, 0.22, 0.04, 24);
  const socketMat = new THREE.MeshStandardMaterial({
    color: theme === 'stone' ? 0x252a35 : theme === 'cathedral3d' ? 0x3b1d60 : 0x1e293b,
    roughness: 0.8,
    metalness: 0.2,
  });

  const innerPitGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.05, 16);
  const innerPitMat = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.95 });

  // Generous invisible hit-sphere for mobile touch detection
  const hitGeo = new THREE.SphereGeometry(0.68, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const index = r * 5 + c;
      const pos = new THREE.Vector3((c - 2) * 1.8, 0.1, (r - 2) * 1.8);

      // Carved socket cup
      const socket = new THREE.Mesh(socketGeo, socketMat);
      socket.position.copy(pos);
      socket.userData = { nodeIndex: index };
      scene.add(socket);
      disposables.push(socket);

      // Deep dark pit center
      const innerPit = new THREE.Mesh(innerPitGeo, innerPitMat);
      innerPit.position.set(pos.x, pos.y + 0.005, pos.z);
      scene.add(innerPit);
      disposables.push(innerPit);

      // Mobile Touch Hit Target
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.copy(pos);
      hitMesh.userData = { nodeIndex: index };
      scene.add(hitMesh);
      disposables.push(hitMesh);
    }
  }

  const cleanup = () => {
    disposables.forEach((obj) => {
      scene.remove(obj);
      if ('geometry' in obj) (obj as THREE.Mesh).geometry.dispose();
      if ('material' in obj) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    });
  };

  return { textures, cleanup };
}

/* --- SCULPTED 3D STONE GAME PIECES --- */

function createTigerMesh(isTrapped = false, theme: BoardTheme = 'stone') {
  const group = new THREE.Group();

  // Tiger Material: Dark Volcanic Basalt / Chiseled Granite
  const bodyMat = new THREE.MeshStandardMaterial({
    color: theme === 'classic' ? 0x2e1808 : 0x14161b,
    roughness: 0.42,
    metalness: theme === 'cathedral3d' ? 0.75 : 0.28,
  });

  // Chiseled Pedestal Base
  const baseGeo = new THREE.CylinderGeometry(0.48, 0.52, 0.12, 16);
  const baseMesh = new THREE.Mesh(baseGeo, bodyMat);
  baseMesh.position.y = 0.06;
  baseMesh.castShadow = true;
  group.add(baseMesh);

  // Powerful geometric predator torso
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.48, 1.02), bodyMat);
  body.position.y = 0.34;
  body.castShadow = true;
  group.add(body);

  // Chiseled feline head with alert contour
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.42, 0.52), bodyMat);
  head.position.set(0, 0.62, 0.5);
  head.castShadow = true;
  group.add(head);

  // Alert ears
  const earGeo = new THREE.ConeGeometry(0.12, 0.24, 4);
  earGeo.rotateY(Math.PI / 4);
  const ear1 = new THREE.Mesh(earGeo, bodyMat);
  ear1.position.set(0.2, 0.9, 0.46);
  group.add(ear1);
  const ear2 = ear1.clone();
  ear2.position.set(-0.2, 0.9, 0.46);
  group.add(ear2);

  // Predatory glowing amber eyes
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.0,
  });
  const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), eyeMat);
  eye1.position.set(0.18, 0.72, 0.74);
  group.add(eye1);
  const eye2 = eye1.clone();
  eye2.position.set(-0.18, 0.72, 0.74);
  group.add(eye2);

  // Trapped state aura
  if (isTrapped) {
    const auraGeo = new THREE.TorusGeometry(0.68, 0.035, 8, 32);
    auraGeo.rotateX(Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true });
    const aura = new THREE.Mesh(auraGeo, auraMat);
    aura.position.y = 0.12;
    group.add(aura);
  }

  return group;
}

function createGoatMesh(theme: BoardTheme = 'stone') {
  const group = new THREE.Group();

  // Goat Material: Sculpted Himalayan White Marble / River Stone
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.1,
  });

  // Chiseled Circular Pedestal Base
  const baseGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.1, 16);
  const baseMesh = new THREE.Mesh(baseGeo, bodyMat);
  baseMesh.position.y = 0.05;
  baseMesh.castShadow = true;
  group.add(baseMesh);

  // Sleek sculpted body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.44, 0.72, 12), bodyMat);
  body.position.y = 0.38;
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  // Mountain goat head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.4), bodyMat);
  head.position.set(0, 0.68, 0.46);
  head.castShadow = true;
  group.add(head);

  // Curved dark slate horns
  const hornMat = new THREE.MeshStandardMaterial({
    color: theme === 'cathedral3d' ? 0x94a3b8 : 0x334155,
    roughness: 0.38,
    metalness: 0.45,
  });
  const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.46, 8), hornMat);
  horn1.position.set(0.12, 0.94, 0.36);
  horn1.rotation.x = -0.32;
  horn1.castShadow = true;
  group.add(horn1);

  const horn2 = horn1.clone();
  horn2.position.set(-0.12, 0.94, 0.36);
  group.add(horn2);

  return group;
}
