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
    const rect = container.getBoundingClientRect();
    const width = Math.max(Math.round(rect.width || container.clientWidth || 360), 100);
    const height = Math.max(Math.round(rect.height || container.clientHeight || 360), 100);

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
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

        // Tap proximity fallback for clicks on the board plate
        if (hit.point) {
          const c = Math.round(hit.point.x / 1.8) + 2;
          const r = Math.round(hit.point.z / 1.8) + 2;
          if (c >= 0 && c <= 4 && r >= 0 && r <= 4) {
            const nodeX = (c - 2) * 1.8;
            const nodeZ = (r - 2) * 1.8;
            const dist = Math.hypot(hit.point.x - nodeX, hit.point.z - nodeZ);
            if (dist <= 0.88) {
              const idx = r * 5 + c;
              const { isInteractive, onNodeClick } = propsRef.current;
              if (isInteractive) {
                onNodeClick(idx);
              }
              break;
            }
          }
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
          const basePosY = isSelected ? 0.52 : 0.18;
          mesh.position.y = basePosY + Math.sin(t + i * 0.6) * 0.02;
        }
      });

      renderer.render(scene, camera);
    };
    animate(performance.now());

    // Resize observer & handler for fluid responsiveness
    const updateSize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const w = Math.max(Math.round(r.width || containerRef.current.clientWidth || 360), 100);
      const h = Math.max(Math.round(r.height || containerRef.current.clientHeight || 360), 100);
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateSize())
      : null;
    if (resizeObserver) {
      resizeObserver.observe(container);
    }
    window.addEventListener('resize', updateSize);

    return () => {
      window.removeEventListener('resize', updateSize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
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

        mesh.position.set(wx, isSelected ? 0.52 : 0.18, wz);
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
      ring.position.set((c - 2) * 1.8, 0.19, (r - 2) * 1.8);
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
      selRing.position.set((c - 2) * 1.8, 0.195, (r - 2) * 1.8);
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

      const p1 = new THREE.Vector3((fc - 2) * 1.8, 0.20, (fr - 2) * 1.8);
      const p2 = new THREE.Vector3((tc - 2) * 1.8, 0.20, (tr - 2) * 1.8);

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
    <div
      className="relative w-full aspect-square mx-auto touch-none select-none flex items-center justify-center p-1 sm:p-2"
      style={{
        maxWidth: 'min(94vw, calc(100dvh - 160px), 440px)',
        maxHeight: 'min(94vw, calc(100dvh - 160px), 440px)',
        width: 'min(94vw, calc(100dvh - 160px), 440px)',
        height: 'min(94vw, calc(100dvh - 160px), 440px)',
      }}
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl border-2 border-stone-800/80 bg-stone-950 flex items-center justify-center">
        <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing touch-none" />

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
    const ambientLight = new THREE.AmbientLight(theme === 'classic' ? 0x3d2b1f : 0x1e2430, 1.2);
    scene.add(ambientLight);
    disposables.push(ambientLight);

    // Warm Sunlit Directional Key Light (Casts crisp real-time shadows)
    const dirLight = new THREE.DirectionalLight(theme === 'classic' ? 0xfef3c7 : 0xfff7ed, 2.2);
    dirLight.position.set(10, 18, 9);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);
    disposables.push(dirLight);

    // Subtle Rim & Fill Light (Highlights contours from opposite side)
    const rimLight = new THREE.DirectionalLight(theme === 'slate' ? 0x38bdf8 : 0x64748b, 1.1);
    rimLight.position.set(-10, 12, -10);
    scene.add(rimLight);
    disposables.push(rimLight);

    // Warm Ground Courtyard Bounce
    const warmBounce = new THREE.PointLight(0xf59e0b, 1.2, 30);
    warmBounce.position.set(12, 6, 8);
    scene.add(warmBounce);
    disposables.push(warmBounce);

    // Solid Granite Altar Pedestal
    const altarColor = theme === 'classic' ? 0x2b1d16 : 0x161820;
    const altarMat = new THREE.MeshStandardMaterial({ color: altarColor, roughness: 0.85, metalness: 0.1 });
    const altar = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.8, 10.4), altarMat);
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

/* --- 3D BAGHCHAL BOARD WITH PHYSICAL CHISELED ENGRAVED LINES --- */

function buildBaghchalBoard3D(
  scene: THREE.Scene,
  theme: BoardTheme
): { textures: { diffuse: THREE.CanvasTexture; bump: THREE.CanvasTexture }; cleanup: () => void } {
  const disposables: THREE.Object3D[] = [];

  // 1. Generate High-Res Procedural Diffuse & Bump Textures for Stone Micro-Grain
  const textures = generateStoneBoardTextures(theme);

  // 2. Heavy Tiered Stone Board Base Slab (Himalayan Black Slate Plinth)
  const baseSlabGeo = new THREE.BoxGeometry(9.6, 0.38, 9.6);
  const baseSlabMat = new THREE.MeshStandardMaterial({
    color: theme === 'classic' ? 0x1b110b : 0x13151b,
    roughness: 0.82,
    metalness: 0.2,
  });
  const baseSlab = new THREE.Mesh(baseSlabGeo, baseSlabMat);
  baseSlab.position.y = -0.02;
  baseSlab.receiveShadow = true;
  scene.add(baseSlab);
  disposables.push(baseSlab);

  // Top Face Stone Playing Slab (Top surface at y = 0.18)
  const plateGeo = new THREE.BoxGeometry(9.1, 0.18, 9.1);
  const plateMat = new THREE.MeshStandardMaterial({
    map: textures.diffuse,
    bumpMap: textures.bump,
    bumpScale: 0.18,
    roughness: 0.62,
    metalness: 0.22,
  });
  const plateMesh = new THREE.Mesh(plateGeo, plateMat);
  plateMesh.position.y = 0.09;
  plateMesh.receiveShadow = true;
  scene.add(plateMesh);
  disposables.push(plateMesh);

  // Ornamental Chiseled Corner Brackets
  const bracketMat = new THREE.MeshStandardMaterial({
    color: theme === 'classic' ? 0xb45309 : theme === 'cathedral3d' ? 0x6b21a8 : 0x334155,
    roughness: 0.35,
    metalness: 0.7,
  });
  [-4.35, 4.35].forEach((cx) => {
    [-4.35, 4.35].forEach((cz) => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.42), bracketMat);
      bracket.position.set(cx, 0.11, cz);
      scene.add(bracket);
      disposables.push(bracket);
    });
  });

  // 3. PHYSICAL 3D ENGRAVED INLAID LINES (100% visible, sharp, authentic chisel glint)
  const lineInlayColor =
    theme === 'classic'
      ? 0xf59e0b
      : theme === 'cathedral3d'
      ? 0xd0bcff
      : theme === 'slate'
      ? 0x38bdf8
      : theme === 'midnight'
      ? 0xc084fc
      : 0xf59e0b; // Gilded antique brass on Himalayan stone

  const trenchMat = new THREE.MeshStandardMaterial({
    color: 0x06070a, // Deep dark carved shadow trench
    roughness: 0.95,
    metalness: 0.1,
  });

  const inlayMat = new THREE.MeshStandardMaterial({
    color: lineInlayColor,
    roughness: 0.24,
    metalness: 0.85,
    emissive: lineInlayColor,
    emissiveIntensity: 0.28,
  });

  // Grid coordinates: 5x5, spacing 1.8 units, bounds [-3.6, +3.6]
  const lineSegments: { p1: [number, number]; p2: [number, number] }[] = [];

  // 5 Horizontals
  for (let i = 0; i < 5; i++) {
    const z = (i - 2) * 1.8;
    lineSegments.push({ p1: [-3.6, z], p2: [3.6, z] });
  }

  // 5 Verticals
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 1.8;
    lineSegments.push({ p1: [x, -3.6], p2: [x, 3.6] });
  }

  // 2 Main Diagonals
  lineSegments.push({ p1: [-3.6, -3.6], p2: [3.6, 3.6] });
  lineSegments.push({ p1: [3.6, -3.6], p2: [-3.6, 3.6] });

  // 4 Diamond Edges
  lineSegments.push({ p1: [0, -3.6], p2: [3.6, 0] });
  lineSegments.push({ p1: [3.6, 0], p2: [0, 3.6] });
  lineSegments.push({ p1: [0, 3.6], p2: [-3.6, 0] });
  lineSegments.push({ p1: [-3.6, 0], p2: [0, -3.6] });

  lineSegments.forEach(({ p1, p2 }) => {
    const [x1, z1] = p1;
    const [x2, z2] = p2;
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.hypot(dx, dz);
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    const angle = Math.atan2(dx, dz);

    // A. Recessed dark chiseled trench
    const trench = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, length), trenchMat);
    trench.position.set(midX, 0.174, midZ);
    trench.rotation.y = angle;
    scene.add(trench);
    disposables.push(trench);

    // B. Gleaming physical inlaid metallic line ribbon
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, length), inlayMat);
    inlay.position.set(midX, 0.178, midZ);
    inlay.rotation.y = angle;
    scene.add(inlay);
    disposables.push(inlay);
  });

  // 4. 25 INTERSECTION CARVED STONE SOCKETS & HIT TARGETS
  const socketRingMat = new THREE.MeshStandardMaterial({
    color: lineInlayColor,
    roughness: 0.3,
    metalness: 0.8,
  });
  const socketCupMat = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    roughness: 0.9,
    metalness: 0.1,
  });
  const hitGeo = new THREE.SphereGeometry(0.72, 8, 8);
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const index = r * 5 + c;
      const pos = new THREE.Vector3((c - 2) * 1.8, 0.179, (r - 2) * 1.8);

      // Outer metallic beveled socket collar ring
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.02, 20), socketRingMat);
      ring.position.copy(pos);
      ring.userData = { nodeIndex: index };
      scene.add(ring);
      disposables.push(ring);

      // Inner sunken dark socket pit where pieces rest
      const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.025, 16), socketCupMat);
      pit.position.set(pos.x, pos.y + 0.005, pos.z);
      scene.add(pit);
      disposables.push(pit);

      // Mobile Touch Hit Target
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.set(pos.x, 0.20, pos.z);
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

/* --- SCULPTED ROYAL BENGAL TIGER (Fierce Predator Figurine) --- */

function createTigerMesh(isTrapped = false, theme: BoardTheme = 'stone') {
  const group = new THREE.Group();

  // Materials: Deep Burnished Bronze / Antique Copper & Volcanic Basalt
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x181a20,
    roughness: 0.4,
    metalness: 0.35,
  });
  const tigerCoatMat = new THREE.MeshStandardMaterial({
    color: theme === 'classic' ? 0xb45309 : 0x9a3412, // Rich dark amber bronze
    roughness: 0.32,
    metalness: 0.65,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0x17120e, // Espresso black tiger stripes
    roughness: 0.4,
    metalness: 0.4,
  });
  const fangMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.1,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.6, // Glowing predatory amber eyes
  });

  // 1. Double-tiered Carved Basalt / Bronze Pedestal Base
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.54, 0.08, 24), baseMat);
  base1.position.y = 0.04;
  base1.castShadow = true;
  base1.receiveShadow = true;
  group.add(base1);

  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.04, 24), stripeMat);
  base2.position.y = 0.095;
  group.add(base2);

  // 2. Muscular Low Stalking Legs & Broad Paws
  // Front Paws
  [-0.18, 0.18].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.095, 0.32, 10), tigerCoatMat);
    leg.position.set(x, 0.24, 0.22);
    leg.rotation.x = -0.15;
    leg.castShadow = true;
    group.add(leg);

    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), tigerCoatMat);
    paw.scale.set(1.2, 0.55, 1.4);
    paw.position.set(x, 0.12, 0.28);
    group.add(paw);
  });

  // Powerful Rear Haunches & Hind Paws
  [-0.19, 0.19].forEach((x) => {
    const thigh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), tigerCoatMat);
    thigh.scale.set(0.9, 1.2, 1.1);
    thigh.position.set(x, 0.32, -0.18);
    thigh.castShadow = true;
    group.add(thigh);

    const rearLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.24, 8), tigerCoatMat);
    rearLeg.position.set(x, 0.20, -0.14);
    rearLeg.rotation.x = 0.3;
    group.add(rearLeg);

    const rearPaw = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), tigerCoatMat);
    rearPaw.scale.set(1.1, 0.5, 1.3);
    rearPaw.position.set(x, 0.11, -0.16);
    group.add(rearPaw);
  });

  // 3. Powerful Arched Predator Body (Chest, Spine, Ribcage)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 14), tigerCoatMat);
  chest.scale.set(1.05, 0.95, 1.3);
  chest.position.set(0, 0.44, 0.14);
  chest.castShadow = true;
  group.add(chest);

  const flank = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), tigerCoatMat);
  flank.scale.set(0.95, 0.88, 1.2);
  flank.position.set(0, 0.42, -0.14);
  flank.castShadow = true;
  group.add(flank);

  // Sculpted Tiger Stripes across spine and flank
  [-0.16, -0.06, 0.06, 0.16].forEach((z) => {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.23 - Math.abs(z) * 0.2, 0.02, 6, 16), stripeMat);
    stripe.position.set(0, 0.46, z);
    stripe.rotation.x = Math.PI / 2;
    group.add(stripe);
  });

  // 4. Long S-Curved Tail Sweeping Upwards
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.42, -0.32);

  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.24, 8), tigerCoatMat);
  t1.position.set(0, 0.06, -0.10);
  t1.rotation.x = -0.9;
  tailGroup.add(t1);

  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.26, 8), tigerCoatMat);
  t2.position.set(0.04, 0.20, -0.18);
  t2.rotation.x = -1.7;
  t2.rotation.y = 0.3;
  tailGroup.add(t2);

  const t3 = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 8), stripeMat);
  t3.position.set(0.08, 0.32, -0.16);
  t3.rotation.x = -2.6;
  tailGroup.add(t3);

  group.add(tailGroup);

  // 5. Powerful Sculpted Tiger Head & Snarl
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.58, 0.44);

  // Thick muscular neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.26, 0.28, 12), tigerCoatMat);
  neck.position.set(0, -0.08, -0.12);
  neck.rotation.x = 0.55;
  headGroup.add(neck);

  // Skull / Cranium
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 12), tigerCoatMat);
  cranium.scale.set(1.15, 0.95, 1.05);
  headGroup.add(cranium);

  // Cheek Fur Ruffs (flaring out from jaw)
  [-1, 1].forEach((dir) => {
    const ruff = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), tigerCoatMat);
    ruff.position.set(dir * 0.20, -0.04, -0.02);
    ruff.rotation.z = dir * 1.2;
    ruff.rotation.y = 0.3;
    headGroup.add(ruff);
  });

  // Rounded Feline Ears with dark backs and white inner tufts
  [-1, 1].forEach((dir) => {
    const earOuter = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), stripeMat);
    earOuter.scale.set(0.9, 1.1, 0.4);
    earOuter.position.set(dir * 0.15, 0.16, -0.06);
    headGroup.add(earOuter);

    const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), fangMat);
    earInner.scale.set(0.8, 1.0, 0.3);
    earInner.position.set(dir * 0.15, 0.16, -0.04);
    headGroup.add(earInner);
  });

  // Snout & Upper Muzzle
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.18), tigerCoatMat);
  muzzle.position.set(0, -0.02, 0.16);
  headGroup.add(muzzle);

  // Black Nose Pad
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.05, 4), stripeMat);
  nose.position.set(0, 0.03, 0.25);
  nose.rotation.x = Math.PI;
  headGroup.add(nose);

  // Open Snarling Lower Jaw with Canine Fangs
  const lowerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.16), stripeMat);
  lowerJaw.position.set(0, -0.10, 0.14);
  lowerJaw.rotation.x = 0.2;
  headGroup.add(lowerJaw);

  // Upper Canine Fangs
  [
    [-0.06, 0.16],
    [0.06, 0.16],
  ].forEach(([fx, fz]) => {
    const fang = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.08, 6), fangMat);
    fang.position.set(fx, -0.06, fz);
    fang.rotation.x = Math.PI;
    headGroup.add(fang);
  });

  // Fierce Glowing Amber Eyes with Dark Brow Ridges
  [-1, 1].forEach((dir) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), eyeMat);
    eye.position.set(dir * 0.11, 0.06, 0.14);
    headGroup.add(eye);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.025, 0.06), stripeMat);
    brow.position.set(dir * 0.11, 0.09, 0.13);
    brow.rotation.z = -dir * 0.2;
    headGroup.add(brow);
  });

  group.add(headGroup);

  // Trapped State: Intricate Crimson Runic Containment Barrier
  if (isTrapped) {
    const auraGroup = new THREE.Group();
    const auraRing1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true })
    );
    auraRing1.rotation.x = Math.PI / 2;
    auraRing1.position.y = 0.14;
    auraGroup.add(auraRing1);

    const auraRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.56, 0.02, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.75 })
    );
    auraRing2.rotation.x = Math.PI / 2;
    auraRing2.position.y = 0.32;
    auraGroup.add(auraRing2);

    group.add(auraGroup);
  }

  return group;
}

/* --- SCULPTED HIMALAYAN MOUNTAIN GOAT (Proud Capra / Ibex Figurine) --- */

function createGoatMesh(theme: BoardTheme = 'stone') {
  const group = new THREE.Group();

  // Turned Himalayan Marble Pedestal & Horn Materials
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x222630,
    roughness: 0.35,
    metalness: 0.25,
  });
  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xfafafa,
    roughness: 0.22,
    metalness: 0.08,
  });
  const hornMat = new THREE.MeshStandardMaterial({
    color: theme === 'cathedral3d' ? 0x94a3b8 : 0x1e293b,
    roughness: 0.32,
    metalness: 0.5,
  });
  const hoofMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.5,
    metalness: 0.2,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.1,
    metalness: 0.9,
  });

  // 1. Turned Pedestal Plinth
  const base1 = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 24), baseMat);
  base1.position.y = 0.04;
  base1.castShadow = true;
  base1.receiveShadow = true;
  group.add(base1);

  const base2 = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.40, 0.05, 24), marbleMat);
  base2.position.y = 0.095;
  base2.castShadow = true;
  group.add(base2);

  // 2. Four Carved Legs with Hooves (Standing proudly on pedestal)
  const legPositions: [number, number][] = [
    [-0.14, 0.20],  // front-left
    [0.14, 0.20],   // front-right
    [-0.15, -0.22], // rear-left
    [0.15, -0.22],  // rear-right
  ];
  legPositions.forEach(([x, z]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.36, 8), marbleMat);
    leg.position.set(x, 0.28, z);
    leg.castShadow = true;
    group.add(leg);

    const hoof = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.06, 8), hoofMat);
    hoof.position.set(x, 0.13, z);
    group.add(hoof);
  });

  // 3. Upright Athletic Body (Chest, Torso, Flank)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 14), marbleMat);
  chest.scale.set(0.9, 1.1, 1.2);
  chest.position.set(0, 0.52, 0.10);
  chest.castShadow = true;
  group.add(chest);

  const rear = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), marbleMat);
  rear.scale.set(0.85, 1.0, 1.0);
  rear.position.set(0, 0.50, -0.18);
  rear.castShadow = true;
  group.add(rear);

  // Short Goat Tail pointing up
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), marbleMat);
  tail.position.set(0, 0.58, -0.34);
  tail.rotation.x = -0.7;
  group.add(tail);

  // 4. Graceful Arched Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.38, 12), marbleMat);
  neck.position.set(0, 0.76, 0.22);
  neck.rotation.x = 0.35;
  neck.castShadow = true;
  group.add(neck);

  // 5. Sculpted Mountain Goat Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.94, 0.32);

  // Cranium
  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), marbleMat);
  cranium.scale.set(0.9, 1.0, 1.1);
  headGroup.add(cranium);

  // Tapered Muzzle / Snout
  const muzzle = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.28, 10), marbleMat);
  muzzle.rotation.x = -1.35;
  muzzle.position.set(0, -0.06, 0.14);
  headGroup.add(muzzle);

  // Black Nose tip
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), hoofMat);
  nose.position.set(0, -0.16, 0.24);
  headGroup.add(nose);

  // Iconic Chin Beard / Goatee (Distinctively Caprine)
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 6), marbleMat);
  beard.position.set(0, -0.24, 0.16);
  beard.rotation.x = -0.4;
  headGroup.add(beard);

  // Two Drooping / Alert Ears
  [-1, 1].forEach((dir) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), marbleMat);
    ear.position.set(dir * 0.13, 0.04, -0.02);
    ear.rotation.z = -dir * 1.0;
    ear.rotation.x = -0.2;
    headGroup.add(ear);
  });

  // Eyes
  [-1, 1].forEach((dir) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), eyeMat);
    eye.position.set(dir * 0.11, 0.02, 0.08);
    headGroup.add(eye);
  });

  // 6. Magnificent Backward-Arching Mountain Ibex Horns
  [-1, 1].forEach((dir) => {
    const hornGroup = new THREE.Group();
    hornGroup.position.set(dir * 0.08, 0.10, -0.02);

    // Segment 1 (Rising up and slight out)
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.18, 8), hornMat);
    s1.position.set(0, 0.09, 0);
    s1.rotation.z = -dir * 0.25;
    s1.rotation.x = -0.3;
    hornGroup.add(s1);

    // Segment 2 (Arching backwards)
    const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.20, 8), hornMat);
    s2.position.set(dir * 0.02, 0.24, -0.07);
    s2.rotation.z = -dir * 0.2;
    s2.rotation.x = -0.9;
    hornGroup.add(s2);

    // Segment 3 (Sweeping down and tapering to sharp tip)
    const s3 = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 8), hornMat);
    s3.position.set(dir * 0.03, 0.30, -0.22);
    s3.rotation.z = -dir * 0.15;
    s3.rotation.x = -1.6;
    hornGroup.add(s3);

    // Ribbed ridges on the horns
    [0.05, 0.12, 0.20].forEach((h) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 6, 12), hornMat);
      ring.position.set(0, h, -h * 0.35);
      ring.rotation.x = Math.PI / 3;
      hornGroup.add(ring);
    });

    headGroup.add(hornGroup);
  });

  group.add(headGroup);

  return group;
}
