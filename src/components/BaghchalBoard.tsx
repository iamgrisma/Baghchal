import React, { useMemo } from 'react';
import { BoardTheme, Move, PieceType, PlayerRole } from '../types';
import { getTrappedTigersInfo } from '../game/rules';

interface BaghchalBoardProps {
  board: PieceType[];
  turn: PlayerRole;
  phase: 'placement' | 'movement';
  goatsInReserve: number;
  selectedPos: number | null;
  validMoves: Move[];
  lastMove: Move | null;
  isInteractive: boolean;
  onNodeClick: (pos: number) => void;
  theme?: BoardTheme;
}

interface ThemeConfig {
  frameOuter: string;
  frameInner: string;
  boardSurface: string;
  grooveDark: string;
  brassLine: string;
  brassLineBorder: string;
  studColor: string;
  studRing: string;
  accentGlow: string;
}

const THEME_STYLES: Record<BoardTheme, ThemeConfig> = {
  classic: {
    frameOuter: '#1c140e',
    frameInner: '#2e1c12',
    boardSurface: '#16100c',
    grooveDark: '#080504',
    brassLine: '#f59e0b',
    brassLineBorder: '#b45309',
    studColor: '#d97706',
    studRing: '#78350f',
    accentGlow: '#f59e0b',
  },
  slate: {
    frameOuter: '#090d16',
    frameInner: '#111827',
    boardSurface: '#0b1120',
    grooveDark: '#020617',
    brassLine: '#38bdf8',
    brassLineBorder: '#0284c7',
    studColor: '#0ea5e9',
    studRing: '#0369a1',
    accentGlow: '#38bdf8',
  },
  midnight: {
    frameOuter: '#090514',
    frameInner: '#170b2c',
    boardSurface: '#0d0618',
    grooveDark: '#020005',
    brassLine: '#c084fc',
    brassLineBorder: '#9333ea',
    studColor: '#a855f7',
    studRing: '#6b21a8',
    accentGlow: '#c084fc',
  },
};

export const BaghchalBoard: React.FC<BaghchalBoardProps> = ({
  board,
  turn,
  phase,
  goatsInReserve,
  selectedPos,
  validMoves,
  lastMove,
  isInteractive,
  onNodeClick,
  theme = 'classic',
}) => {
  const currentTheme = THEME_STYLES[theme] || THEME_STYLES.classic;

  const SIZE = 500;
  const PADDING = 48;
  const STEP = (SIZE - 2 * PADDING) / 4;

  const nodeCoords = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => {
      const r = Math.floor(i / 5);
      const c = i % 5;
      return {
        x: PADDING + c * STEP,
        y: PADDING + r * STEP,
      };
    });
  }, [STEP, PADDING]);

  const trappedInfo = useMemo(() => getTrappedTigersInfo(board), [board]);

  const validDestinationMap = useMemo(() => {
    const map = new Map<number, Move>();
    for (const m of validMoves) {
      map.set(m.to, m);
    }
    return map;
  }, [validMoves]);

  return (
    <div className="relative w-full aspect-square max-w-[min(94vw,460px)] mx-auto touch-none select-none flex items-center justify-center">
      <div className="relative w-full h-full rounded-3xl p-2 sm:p-2.5 shadow-2xl border-2 border-stone-800/80 bg-gradient-to-br from-stone-900 via-stone-950 to-black overflow-hidden flex items-center justify-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full overflow-visible">
          <defs>
            {/* Realistic Token Drop Shadows */}
            <filter id="pieceShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.75" />
            </filter>
            <filter id="liftedShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="10" stdDeviation="7" floodColor="#000000" floodOpacity="0.9" />
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={currentTheme.accentGlow} floodOpacity="0.6" />
            </filter>
            <filter id="boardInsetShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.8" />
            </filter>

            {/* 3D Bronze Tiger Token Gradients */}
            <radialGradient id="tigerFaceGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="85%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </radialGradient>
            <linearGradient id="tigerRimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#451a03" />
            </linearGradient>

            {/* 3D Ivory Goat Token Gradients */}
            <radialGradient id="goatFaceGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="55%" stopColor="#f1f5f9" />
              <stop offset="85%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>
            <linearGradient id="goatRimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>

            {/* Beveled Wood Table Surface */}
            <radialGradient id="woodSurfaceGrad" cx="50%" cy="50%" r="75%">
              <stop offset="0%" stopColor={currentTheme.frameInner} />
              <stop offset="100%" stopColor={currentTheme.boardSurface} />
            </radialGradient>
          </defs>

          {/* 1. PHYSICAL 3D BEVELED BOARD RIM */}
          <rect
            x="8"
            y="8"
            width={SIZE - 16}
            height={SIZE - 16}
            rx="24"
            fill={currentTheme.frameOuter}
            stroke="#000000"
            strokeWidth="3"
          />
          <rect
            x="14"
            y="14"
            width={SIZE - 28}
            height={SIZE - 28}
            rx="20"
            fill="url(#woodSurfaceGrad)"
            stroke={currentTheme.frameInner}
            strokeWidth="2.5"
            filter="url(#boardInsetShadow)"
          />

          {/* Brass Corner Brackets */}
          {[
            [20, 20],
            [SIZE - 36, 20],
            [20, SIZE - 36],
            [SIZE - 36, SIZE - 36],
          ].map(([bx, by], idx) => (
            <rect
              key={`corner-${idx}`}
              x={bx}
              y={by}
              width="16"
              height="16"
              rx="4"
              fill={currentTheme.brassLine}
              opacity="0.25"
            />
          ))}

          {/* 2. RECESSED CARVED GROOVES */}
          <g stroke={currentTheme.grooveDark} strokeWidth="5.5" strokeLinecap="round">
            <rect x={PADDING} y={PADDING} width={SIZE - 2 * PADDING} height={SIZE - 2 * PADDING} fill="none" />
            {[1, 2, 3].map((r) => (
              <line key={`gh-${r}`} x1={PADDING} y1={PADDING + r * STEP} x2={SIZE - PADDING} y2={PADDING + r * STEP} />
            ))}
            {[1, 2, 3].map((c) => (
              <line key={`gv-${c}`} x1={PADDING + c * STEP} y1={PADDING} x2={PADDING + c * STEP} y2={SIZE - PADDING} />
            ))}
            <line x1={PADDING} y1={PADDING} x2={SIZE - PADDING} y2={SIZE - PADDING} />
            <line x1={SIZE - PADDING} y1={PADDING} x2={PADDING} y2={SIZE - PADDING} />
            <line x1={PADDING + 2 * STEP} y1={PADDING} x2={PADDING} y2={PADDING + 2 * STEP} />
            <line x1={PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={SIZE - PADDING} />
            <line x1={PADDING + 2 * STEP} y1={SIZE - PADDING} x2={SIZE - PADDING} y2={PADDING + 2 * STEP} />
            <line x1={SIZE - PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={PADDING} />
          </g>

          {/* 3. POLISHED INLAID BRASS CHANNELS */}
          <g stroke={currentTheme.brassLine} strokeWidth="2.8" strokeLinecap="round">
            <rect x={PADDING} y={PADDING} width={SIZE - 2 * PADDING} height={SIZE - 2 * PADDING} fill="none" strokeWidth="3.6" />
            {[1, 2, 3].map((r) => (
              <line key={`h-${r}`} x1={PADDING} y1={PADDING + r * STEP} x2={SIZE - PADDING} y2={PADDING + r * STEP} />
            ))}
            {[1, 2, 3].map((c) => (
              <line key={`v-${c}`} x1={PADDING + c * STEP} y1={PADDING} x2={PADDING + c * STEP} y2={SIZE - PADDING} />
            ))}
            <line x1={PADDING} y1={PADDING} x2={SIZE - PADDING} y2={SIZE - PADDING} />
            <line x1={SIZE - PADDING} y1={PADDING} x2={PADDING} y2={SIZE - PADDING} />
            <line x1={PADDING + 2 * STEP} y1={PADDING} x2={PADDING} y2={PADDING + 2 * STEP} />
            <line x1={PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={SIZE - PADDING} />
            <line x1={PADDING + 2 * STEP} y1={SIZE - PADDING} x2={SIZE - PADDING} y2={PADDING + 2 * STEP} />
            <line x1={SIZE - PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={PADDING} />
          </g>

          {/* Last Move Trail */}
          {lastMove && lastMove.from !== undefined && (
            <line
              x1={nodeCoords[lastMove.from].x}
              y1={nodeCoords[lastMove.from].y}
              x2={nodeCoords[lastMove.to].x}
              y2={nodeCoords[lastMove.to].y}
              stroke={lastMove.type === 'jump' ? '#ef4444' : currentTheme.accentGlow}
              strokeWidth={lastMove.type === 'jump' ? '4.5' : '3'}
              strokeDasharray={lastMove.type === 'jump' ? '8 4' : '6 4'}
              strokeOpacity="0.9"
            />
          )}

          {/* 4. INTERSECTION STUDS & GAME TOKENS */}
          {nodeCoords.map((pos, idx) => {
            const piece = board[idx];
            const isSelected = selectedPos === idx;
            const validMove = validDestinationMap.get(idx);
            const isTarget = !!validMove;
            const isJumpTarget = validMove?.type === 'jump';
            const isTrappedTiger = piece === 'tiger' && trappedInfo.trappedIndices.includes(idx);

            return (
              <g
                key={`node-${idx}`}
                onClick={() => isInteractive && onNodeClick(idx)}
                className={isInteractive ? 'cursor-pointer' : ''}
              >
                {/* Brass Rivet Stud */}
                <circle cx={pos.x} cy={pos.y} r="5" fill={currentTheme.studColor} stroke={currentTheme.studRing} strokeWidth="1.6" />
                <circle cx={pos.x - 1.2} cy={pos.y - 1.2} r="1.5" fill="#ffffff" opacity="0.6" />

                {/* Tactical Beacon for valid placements/moves */}
                {isTarget && (
                  <g className="transition-transform duration-150 hover:scale-110">
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isJumpTarget ? 18 : 14}
                      fill={isJumpTarget ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.22)'}
                      stroke={isJumpTarget ? '#ef4444' : currentTheme.brassLine}
                      strokeWidth={isJumpTarget ? 2.5 : 2}
                      className="animate-pulse"
                    />
                    <circle cx={pos.x} cy={pos.y} r={isJumpTarget ? 6 : 4.5} fill={isJumpTarget ? '#ef4444' : currentTheme.brassLine} />
                  </g>
                )}

                {/* 5. WEIGHTED 3D GAME TOKENS */}
                {piece && (
                  <g
                    transform={isSelected ? `translate(0, -6) scale(1.08)` : undefined}
                    filter={isSelected ? 'url(#liftedShadow)' : 'url(#pieceShadow)'}
                    className="transition-transform duration-200"
                  >
                    {/* A. TIGER TOKEN (Sculpted Bronze Medallion) */}
                    {piece === 'tiger' && (
                      <g>
                        <circle cx={pos.x} cy={pos.y + 1.5} r="22" fill="url(#tigerRimGrad)" />
                        <circle cx={pos.x} cy={pos.y} r="21.5" fill="url(#tigerFaceGrad)" stroke="#fde047" strokeWidth={isSelected ? 2.5 : 1.2} />
                        <circle cx={pos.x} cy={pos.y} r="18.5" fill="none" stroke="#78350f" strokeWidth="1.2" opacity="0.8" />
                        <path d={`M${pos.x - 14} ${pos.y - 10} C${pos.x - 8} ${pos.y - 18} ${pos.x + 8} ${pos.y - 18} ${pos.x + 14} ${pos.y - 10}`} fill="none" stroke="#fef08a" strokeWidth="1.4" opacity="0.75" />

                        {/* Embossed Tiger Face */}
                        <g transform={`translate(${pos.x - 11}, ${pos.y - 11})`}>
                          <path d="M4 6 C2 1 6 0 8 4 Z" fill="#291204" />
                          <path d="M18 6 C20 1 16 0 14 4 Z" fill="#291204" />
                          <circle cx="7.5" cy="10" r="1.5" fill="#fef08a" />
                          <circle cx="14.5" cy="10" r="1.5" fill="#fef08a" />
                          <circle cx="7.5" cy="10" r="0.6" fill="#1c1917" />
                          <circle cx="14.5" cy="10" r="0.6" fill="#1c1917" />
                          <polygon points="11,12.5 9,11 13,11" fill="#291204" />
                          <path d="M8 14 C10 15.5 12 15.5 14 14" stroke="#291204" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                          <line x1="11" y1="4.5" x2="11" y2="7.5" stroke="#291204" strokeWidth="1.5" strokeLinecap="round" />
                        </g>

                        {/* Trapped State Ring */}
                        {isTrappedTiger && (
                          <circle cx={pos.x} cy={pos.y} r="24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 3" className="animate-spin-slow" />
                        )}
                      </g>
                    )}

                    {/* B. GOAT TOKEN (Carved Ivory / Marble Stone) */}
                    {piece === 'goat' && (
                      <g>
                        <circle cx={pos.x} cy={pos.y + 1.2} r="18.5" fill="url(#goatRimGrad)" />
                        <circle cx={pos.x} cy={pos.y} r="18" fill="url(#goatFaceGrad)" stroke="#ffffff" strokeWidth={isSelected ? 2.5 : 1} />
                        <circle cx={pos.x} cy={pos.y} r="15" fill="none" stroke="#cbd5e1" strokeWidth="1" opacity="0.9" />
                        <path d={`M${pos.x - 11} ${pos.y - 8} C${pos.x - 6} ${pos.y - 14} ${pos.x + 6} ${pos.y - 14} ${pos.x + 11} ${pos.y - 8}`} fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.9" />

                        {/* Carved Mountain Goat Emblem */}
                        <g transform={`translate(${pos.x - 10}, ${pos.y - 10})`}>
                          <path d="M5 8 C3 2 7 0.5 9 5" stroke="#1e293b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                          <path d="M15 8 C17 2 13 0.5 11 5" stroke="#1e293b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
                          <circle cx="7" cy="11.5" r="1.3" fill="#0f172a" />
                          <circle cx="13" cy="11.5" r="1.3" fill="#0f172a" />
                          <path d="M8.5 14 C10 15.5 11.5 15.5 13 14" stroke="#334155" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                        </g>
                      </g>
                    )}
                  </g>
                )}

                {/* Touch Hitbox */}
                <circle cx={pos.x} cy={pos.y} r="25" fill="transparent" className="cursor-pointer active:opacity-20" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
