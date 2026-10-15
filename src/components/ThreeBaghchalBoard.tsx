import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import TWEEN from '@tweenjs/tween.js';
import { GameState, Position } from '../types';

interface ThreeBaghchalBoardProps {
  gameState: GameState;
  onMakeMove: (from: Position | null, to: Position) => void;
  selectedPiece: Position | null;
  validMoves: Position[];
  onSelectPiece: (pos: Position | null) => void;
  isAiThinking?: boolean;
}

export const ThreeBaghchalBoard: React.FC<ThreeBaghchalBoardProps> = ({
  gameState,
  onMakeMove,
  selectedPiece,
  validMoves,
  onSelectPiece,
  isAiThinking,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  const pieceMeshesRef = useRef<{ [key: string]: THREE.Group }>({});
  const highlightsRef = useRef<THREE.Mesh[]>([]);

  // Keep latest props in refs for raycaster callback
  const propsRef = useRef({ gameState, selectedPiece, validMoves, onMakeMove, onSelectPiece });
  useEffect(() => {
    propsRef.current = { gameState, selectedPiece, validMoves, onMakeMove, onSelectPiece };
  });

  const [cameraView, setCameraView] = useState<'cinematic' | 'top'>('cinematic');

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c10);
    scene.fog = new THREE.FogExp2(0x0b0c10, 0.03);
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
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 5;
    controls.maxDistance = 22;
    controlsRef.current = controls;

    // 5. Lighting (Gothic Cathedral Atmosphere)
    const ambientLight = new THREE.AmbientLight(0x282c37, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xdbeafe, 2.2);
    dirLight.position.set(12, 20, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const purpleLight = new THREE.PointLight(0x8b5cf6, 3.5, 35);
    purpleLight.position.set(-14, 10, -10);
    scene.add(purpleLight);

    const cyanLight = new THREE.PointLight(0x06b6d4, 3.5, 35);
    cyanLight.position.set(14, 10, 10);
    scene.add(cyanLight);

    // 6. Build Cathedral Environment & Board
    buildCathedralEnvironment(scene);
    const boardPositions = buildBaghchalBoard3D(scene);

    // 7. Raycasting for piece/node selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      for (let hit of intersects) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && obj !== scene && obj.userData?.r === undefined && obj.userData?.nodeIndex === undefined) {
          obj = obj.parent;
        }

        if (obj && obj.userData) {
          let pos: Position | null = null;
          if (obj.userData.r !== undefined && obj.userData.c !== undefined) {
            pos = { r: obj.userData.r, c: obj.userData.c };
          } else if (obj.userData.nodeIndex !== undefined) {
            const idx = obj.userData.nodeIndex;
            pos = { r: Math.floor(idx / 5), c: idx % 5 };
          }

          if (pos) {
            const { gameState, selectedPiece, validMoves, onMakeMove, onSelectPiece } = propsRef.current;
            const piece = gameState.board[pos.r][pos.c];

            // If clicking a valid move target
            const isValidTarget = validMoves.some(vm => vm.r === pos!.r && vm.c === pos!.c);
            if (isValidTarget && selectedPiece) {
              onMakeMove(selectedPiece, pos);
            } else if (piece && ((gameState.turn === 'goat' && piece === 'goat') || (gameState.turn === 'tiger' && piece === 'tiger'))) {
              onSelectPiece(pos);
            } else if (gameState.turn === 'goat' && gameState.phase === 'placement' && !piece) {
              onMakeMove(null, pos);
            } else {
              onSelectPiece(null);
            }
            break;
          }
        }
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', handlePointerDown);

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = (time: number) => {
      animationFrameId = requestAnimationFrame(animate);
      TWEEN.update();
      controls.update();

      // Idle breathing for pieces
      const t = time * 0.003;
      Object.keys(pieceMeshesRef.current).forEach((key, i) => {
        const mesh = pieceMeshesRef.current[key];
        if (mesh && !mesh.userData.isAnimating) {
          const basePosY = mesh.userData.basePosY || 0.05;
          mesh.position.y = basePosY + Math.sin(t + i * 0.6) * 0.03;
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
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update 3D Pieces when gameState or selection changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old pieces
    Object.values(pieceMeshesRef.current).forEach(mesh => scene.remove(mesh));
    pieceMeshesRef.current = {};

    // Render current board pieces
    gameState.board.forEach((row, r) => {
      row.forEach((pieceType, c) => {
        if (pieceType) {
          const mesh = pieceType === 'tiger' ? createTigerMesh() : createGoatMesh();
          const wx = (c - 2) * 1.8;
          const wz = (r - 2) * 1.8;
          mesh.position.set(wx, 0.05, wz);
          mesh.userData = { r, c, basePosY: 0.05, pieceType };
          scene.add(mesh);
          pieceMeshesRef.current[`${r}-${c}`] = mesh;
        }
      });
    });

    // Update Highlights for valid moves & selection
    highlightsRef.current.forEach(h => scene.remove(h));
    highlightsRef.current = [];

    const ringGeo = new THREE.RingGeometry(0.25, 0.35, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd0bcff, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });

    validMoves.forEach(vm => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set((vm.c - 2) * 1.8, 0.08, (vm.r - 2) * 1.8);
      scene.add(ring);
      highlightsRef.current.push(ring);
    });

    if (selectedPiece) {
      const selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
      selRing.position.set((selectedPiece.c - 2) * 1.8, 0.08, (selectedPiece.r - 2) * 1.8);
      scene.add(selRing);
      highlightsRef.current.push(selRing);
    }
  }, [gameState, selectedPiece, validMoves]);

  const handleCameraChange = (view: 'cinematic' | 'top') => {
    setCameraView(view);
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    if (view === 'top') {
      new TWEEN.Tween(camera.position).to({ x: 0, y: 15, z: 0.01 }, 1000).easing(TWEEN.Easing.Cubic.Out).start();
      controls.target.set(0, 0, 0);
    } else {
      new TWEEN.Tween(camera.position).to({ x: 0, y: 13, z: 11 }, 1000).easing(TWEEN.Easing.Cubic.Out).start();
      controls.target.set(0, 0, 0);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating Camera View Toggle HUD */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-[#1e1f24]/90 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-xl">
        <button
          onClick={() => handleCameraChange('cinematic')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${cameraView === 'cinematic' ? 'bg-[#d0bcff] text-[#381e72]' : 'text-slate-300 hover:text-white'}`}
        >
          Cinematic
        </button>
        <button
          onClick={() => handleCameraChange('top')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${cameraView === 'top' ? 'bg-[#d0bcff] text-[#381e72]' : 'text-slate-300 hover:text-white'}`}
        >
          Top-Down
        </button>
      </div>

      {isAiThinking && (
        <div className="absolute top-4 left-4 z-20 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2 backdrop-blur-md animate-pulse">
          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
          बाघ (AI) ले चाल सोच्दैछ...
        </div>
      )}
    </div>
  );
};

/* --- Helper functions for 3D generation --- */

function buildCathedralEnvironment(scene: THREE.Scene) {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x14151a, roughness: 0.8, metalness: 0.2 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  // Altar Table for Board
  const tableGeo = new THREE.BoxGeometry(10, 0.8, 10);
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x1f2029, roughness: 0.7, metalness: 0.3 });
  const table = new THREE.Mesh(tableGeo, tableMat);
  table.position.y = -0.5;
  table.castShadow = true;
  table.receiveShadow = true;
  scene.add(table);

  // Pillars
  const pillarGeo = new THREE.CylinderGeometry(0.7, 0.8, 16, 8);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x22232d, roughness: 0.9 });
  [-12, 12].forEach(x => {
    [-12, 12].forEach(z => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, 7.5, z);
      pillar.castShadow = true;
      scene.add(pillar);
    });
  });
}

function buildBaghchalBoard3D(scene: THREE.Scene) {
  // Board Slab
  const boardGeo = new THREE.BoxGeometry(9, 0.3, 9);
  const boardMat = new THREE.MeshStandardMaterial({ color: 0x22242f, roughness: 0.4, metalness: 0.3 });
  const boardMesh = new THREE.Mesh(boardGeo, boardMat);
  boardMesh.position.y = -0.1;
  boardMesh.receiveShadow = true;
  scene.add(boardMesh);

  const boardPositions: { r: number; c: number; pos: THREE.Vector3 }[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      boardPositions.push({ r, c, pos: new THREE.Vector3((c - 2) * 1.8, 0.05, (r - 2) * 1.8) });
    }
  }

  // Draw full grid lines with diagonal connections
  const lineMat = new THREE.LineBasicMaterial({ color: 0xd0bcff, transparent: true, opacity: 0.45 });

  // Orthogonal grid lines
  for (let i = 0; i < 5; i++) {
    // Horizontal
    const hPoints = [boardPositions[i * 5].pos, boardPositions[i * 5 + 4].pos];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(hPoints), lineMat));

    // Vertical
    const vPoints = [boardPositions[i].pos, boardPositions[i + 20].pos];
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vPoints), lineMat));
  }

  // Exact Baghchal diagonal lines (outer square diagonals and central star diagonals)
  const diagonalPairs = [
    [0, 24], [4, 20], // Outer big X
    [0, 12], [12, 24],
    [4, 12], [12, 20],
    [0, 6], [6, 12], [12, 18], [18, 24],
    [4, 8], [8, 12], [12, 16], [16, 20],
    // Inner box diagonals and midpoints
    [1, 7], [7, 13], [13, 19], [3, 7], [7, 11], [11, 15],
    [5, 11], [11, 17], [9, 13], [13, 17],
    [0, 2], [2, 4], [0, 10], [10, 20], [4, 14], [14, 24], [20, 22], [22, 24]
  ];

  const drawnLines = new Set<string>();
  diagonalPairs.forEach(([a, b]) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}`;
    if (!drawnLines.has(key)) {
      drawnLines.add(key);
      const points = [boardPositions[a].pos, boardPositions[b].pos];
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat));
    }
  });

  // Intersection Nodes
  const nodeGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16);
  const nodeMat = new THREE.MeshStandardMaterial({ color: 0x4f378b, roughness: 0.3, metalness: 0.8 });

  boardPositions.forEach(({ r, c, pos }) => {
    const node = new THREE.Mesh(nodeGeo, nodeMat);
    node.position.copy(pos);
    node.userData = { r, c, nodeIndex: r * 5 + c };
    scene.add(node);
  });

  return boardPositions;
}

function createTigerMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.45, 1.0),
    new THREE.MeshStandardMaterial({ color: 0x111115, roughness: 0.3, metalness: 0.8 })
  );
  body.position.y = 0.3;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.4, 0.5),
    body.material
  );
  head.position.set(0, 0.6, 0.5);
  head.castShadow = true;
  group.add(head);

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.6 });
  const eye1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), goldMat);
  eye1.position.set(0.18, 0.7, 0.72);
  group.add(eye1);
  const eye2 = eye1.clone();
  eye2.position.set(-0.18, 0.7, 0.72);
  group.add(eye2);

  return group;
}

function createGoatMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 0.7, 8),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.1 })
  );
  body.position.y = 0.35;
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.35, 0.4),
    body.material
  );
  head.position.set(0, 0.65, 0.45);
  head.castShadow = true;
  group.add(head);

  const hornMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.5 });
  const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8), hornMat);
  horn1.position.set(0.12, 0.9, 0.35);
  horn1.rotation.x = -0.3;
  group.add(horn1);
  const horn2 = horn1.clone();
  horn2.position.set(-0.12, 0.9, 0.35);
  group.add(horn2);

  return group;
}
