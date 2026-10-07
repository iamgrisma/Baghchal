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
  containerBg: string;
  cornerBorder: string;
  boardSurface: string;
  boardBorder: string;
  linePrimary: string;
  lineSecondary: string;
  grooveStroke: string;
  studFill: string;
  studStroke: string;
  accentGlow: string;
}

const THEME_STYLES: Record<BoardTheme, ThemeConfig> = {
  classic: {
    containerBg: 'from-stone-900 via-stone-925 to-stone-950 border-stone-800 ring-amber-950/40 shadow-2xl',
    cornerBorder: 'border-amber-600/60',
    boardSurface: '#1c1917',
    boardBorder: '#44403c',
    linePrimary: '#f59e0b',
    lineSecondary: '#d97706',
    grooveStroke: '#0c0a09',
    studFill: '#292524',
    studStroke: '#78350f',
    accentGlow: '#f59e0b',
  },
  slate: {
    containerBg: 'from-slate-900 via-slate-950 to-stone-950 border-cyan-900/50 ring-cyan-950/50 shadow-2xl',
    cornerBorder: 'border-cyan-500/60',
    boardSurface: '#0f172a',
    boardBorder: '#334155',
    linePrimary: '#38bdf8',
    lineSecondary: '#0284c7',
    grooveStroke: '#020617',
    studFill: '#1e293b',
    studStroke: '#0369a1',
    accentGlow: '#38bdf8',
  },
  midnight: {
    containerBg: 'from-zinc-950 via-purple-950/30 to-black border-purple-900/50 ring-purple-950/60 shadow-2xl',
    cornerBorder: 'border-purple-500/60',
    boardSurface: '#09090b',
    boardBorder: '#27272a',
    linePrimary: '#c084fc',
    lineSecondary: '#9333ea',
    grooveStroke: '#000000',
    studFill: '#18181b',
    studStroke: '#581c87',
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
  const PADDING = 46;
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

  const capturedGoatPositions = useMemo(() => {
    const set = new Set<number>();
    for (const m of validMoves) {
      if (m.type === 'jump' && m.captured !== undefined) {
        set.add(m.captured);
      }
    }
    return set;
  }, [validMoves]);

  return (
    <div className="relative w-full aspect-square max-w-[min(94vw,460px)] mx-auto touch-none select-none flex items-center justify-center">
      <div
        className={`relative w-full h-full rounded-3xl bg-gradient-to-br ${currentTheme.containerBg} p-2 sm:p-2.5 border-2 ring-1 flex items-center justify-center overflow-hidden`}
      >
        {/* Subtle Nepali Corner Inlays */}
        <div
          className={`absolute top-2.5 left-2.5 w-4 h-4 border-t-2 border-l-2 ${currentTheme.cornerBorder} rounded-tl-sm pointer-events-none`}
        />
        <div
          className={`absolute top-2.5 right-2.5 w-4 h-4 border-t-2 border-r-2 ${currentTheme.cornerBorder} rounded-tr-sm pointer-events-none`}
        />
        <div
          className={`absolute bottom-2.5 left-2.5 w-4 h-4 border-b-2 border-l-2 ${currentTheme.cornerBorder} rounded-bl-sm pointer-events-none`}
        />
        <div
          className={`absolute bottom-2.5 right-2.5 w-4 h-4 border-b-2 border-r-2 ${currentTheme.cornerBorder} rounded-br-sm pointer-events-none`}
        />

        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full overflow-visible">
          <defs>
            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor={currentTheme.accentGlow} floodOpacity="0.85" />
            </filter>
            <filter id="crimsonGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.8" />
            </filter>
            <filter id="pieceShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
            </filter>

            <linearGradient id="tigerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="50%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#9a3412" />
            </linearGradient>

            <linearGradient id="goatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
          </defs>

          {/* Board Background Surface */}
          <rect
            x={PADDING - 14}
            y={PADDING - 14}
            width={SIZE - 2 * PADDING + 28}
            height={SIZE - 2 * PADDING + 28}
            rx="16"
            fill={currentTheme.boardSurface}
            stroke={currentTheme.boardBorder}
            strokeWidth="1.5"
          />

          {/* Carved Groove Base Layer */}
          <g stroke={currentTheme.grooveStroke} strokeWidth="4.5" strokeLinecap="round">
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

          {/* Active Grid Lines */}
          <g stroke={currentTheme.lineSecondary} strokeWidth="2.5" strokeLinecap="round">
            <rect
              x={PADDING}
              y={PADDING}
              width={SIZE - 2 * PADDING}
              height={SIZE - 2 * PADDING}
              fill="none"
              stroke={currentTheme.linePrimary}
              strokeWidth="3.5"
            />
            {[1, 2, 3].map((r) => (
              <line
                key={`h-${r}`}
                x1={PADDING}
                y1={PADDING + r * STEP}
                x2={SIZE - PADDING}
                y2={PADDING + r * STEP}
                stroke={currentTheme.linePrimary}
              />
            ))}
            {[1, 2, 3].map((c) => (
              <line
                key={`v-${c}`}
                x1={PADDING + c * STEP}
                y1={PADDING}
                x2={PADDING + c * STEP}
                y2={SIZE - PADDING}
                stroke={currentTheme.linePrimary}
              />
            ))}
            <line x1={PADDING} y1={PADDING} x2={SIZE - PADDING} y2={SIZE - PADDING} stroke={currentTheme.lineSecondary} />
            <line x1={SIZE - PADDING} y1={PADDING} x2={PADDING} y2={SIZE - PADDING} stroke={currentTheme.lineSecondary} />
            <line x1={PADDING + 2 * STEP} y1={PADDING} x2={PADDING} y2={PADDING + 2 * STEP} stroke={currentTheme.lineSecondary} />
            <line x1={PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={SIZE - PADDING} stroke={currentTheme.lineSecondary} />
            <line x1={PADDING + 2 * STEP} y1={SIZE - PADDING} x2={SIZE - PADDING} y2={PADDING + 2 * STEP} stroke={currentTheme.lineSecondary} />
            <line x1={SIZE - PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={PADDING} stroke={currentTheme.lineSecondary} />
          </g>

          {/* Move Trail */}
          {lastMove && lastMove.from !== undefined && (
            <line
              x1={nodeCoords[lastMove.from].x}
              y1={nodeCoords[lastMove.from].y}
              x2={nodeCoords[lastMove.to].x}
              y2={nodeCoords[lastMove.to].y}
              stroke={lastMove.type === 'jump' ? '#ef4444' : currentTheme.accentGlow}
              strokeWidth={lastMove.type === 'jump' ? '4.5' : '3'}
              strokeDasharray={lastMove.type === 'jump' ? '8 4' : '6 4'}
              strokeOpacity={lastMove.type === 'jump' ? '0.95' : '0.6'}
            />
          )}

          {/* Captured Slash Indicator */}
          {lastMove && lastMove.type === 'jump' && lastMove.captured !== undefined && (
            <g>
              <circle
                cx={nodeCoords[lastMove.captured].x}
                cy={nodeCoords[lastMove.captured].y}
                r="22"
                fill="rgba(239, 68, 68, 0.35)"
                stroke="#ef4444"
                strokeWidth="2.5"
                className="animate-ping"
              />
              <g transform={`translate(${nodeCoords[lastMove.captured].x}, ${nodeCoords[lastMove.captured].y})`}>
                <line x1="-12" y1="-14" x2="-2" y2="14" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
                <line x1="-2" y1="-16" x2="8" y2="12" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="8" y1="-13" x2="16" y2="13" stroke="#991b1b" strokeWidth="3" strokeLinecap="round" />
              </g>
            </g>
          )}

          {/* Intersection Points & Nodes */}
          {nodeCoords.map((pos, idx) => {
            const piece = board[idx];
            const isSelected = selectedPos === idx;
            const validMove = validDestinationMap.get(idx);
            const isTarget = !!validMove;
            const isJumpTarget = validMove?.type === 'jump';
            const isCapturedGoat = capturedGoatPositions.has(idx);
            const isTrappedTiger = piece === 'tiger' && trappedInfo.trappedIndices.includes(idx);
            const isLastMoveDestination = lastMove?.to === idx;

            return (
              <g
                key={`node-${idx}`}
                id={`board-node-${idx}`}
                onClick={() => isInteractive && onNodeClick(idx)}
                className={isInteractive ? 'cursor-pointer' : ''}
              >
                {/* Node Stud */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="5.5"
                  fill={currentTheme.studFill}
                  stroke={currentTheme.studStroke}
                  strokeWidth="1.5"
                />

                {/* Last Move Halo Ring */}
                {isLastMoveDestination && !isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={piece === 'tiger' ? 26 : 23}
                    fill="none"
                    stroke={currentTheme.accentGlow}
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    className="animate-spin-slow"
                  />
                )}

                {/* Valid Destination Indicators */}
                {isTarget && (
                  <g className="transition-transform duration-150 hover:scale-110">
                    {phase === 'placement' ? (
                      <>
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="12"
                          fill="rgba(245, 158, 11, 0.16)"
                          stroke={currentTheme.linePrimary}
                          strokeWidth="1.5"
                          strokeDasharray="3 2"
                        />
                        <circle cx={pos.x} cy={pos.y} r="4.5" fill={currentTheme.linePrimary} />
                      </>
                    ) : (
                      <>
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isJumpTarget ? 20 : 16}
                          fill={isJumpTarget ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}
                          stroke={isJumpTarget ? '#ef4444' : currentTheme.linePrimary}
                          strokeWidth={isJumpTarget ? 2.5 : 2}
                          className="animate-pulse"
                        />
                        <circle cx={pos.x} cy={pos.y} r={isJumpTarget ? 6.5 : 5} fill={isJumpTarget ? '#ef4444' : currentTheme.linePrimary} />
                      </>
                    )}
                  </g>
                )}

                {/* Pieces */}
                {piece && (
                  <g
                    filter={
                      isSelected
                        ? 'url(#goldGlow)'
                        : isCapturedGoat
                        ? 'url(#crimsonGlow)'
                        : 'url(#pieceShadow)'
                    }
                  >
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={piece === 'tiger' ? 22.5 : 19.5}
                      fill={piece === 'tiger' ? 'url(#tigerGrad)' : 'url(#goatGrad)'}
                      stroke={
                        isSelected
                          ? '#fde047'
                          : isCapturedGoat
                          ? '#ef4444'
                          : piece === 'tiger'
                          ? '#78350f'
                          : '#475569'
                      }
                      strokeWidth={isSelected ? 3.5 : 2}
                      className="transition-transform duration-150"
                    />

                    {/* Tiger Face Detail */}
                    {piece === 'tiger' && (
                      <g transform={`translate(${pos.x - 13}, ${pos.y - 13}) scale(1.1)`}>
                        <path d="M4 6 C2 1 6 0 8 4 Z" fill="#451a03" />
                        <path d="M20 6 C22 1 18 0 16 4 Z" fill="#451a03" />
                        <circle cx="8" cy="11" r="1.6" fill="#fef08a" />
                        <circle cx="16" cy="11" r="1.6" fill="#fef08a" />
                        <polygon points="12,14 10,12 14,12" fill="#451a03" />
                        <path d="M9 16 C11 17.5 13 17.5 15 16" stroke="#451a03" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                        <line x1="12" y1="4.5" x2="12" y2="8" stroke="#451a03" strokeWidth="1.5" />
                      </g>
                    )}

                    {/* Goat Face Detail */}
                    {piece === 'goat' && (
                      <g transform={`translate(${pos.x - 12}, ${pos.y - 12})`}>
                        <path d="M6 9 C4 3 8 1 10 6" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
                        <path d="M18 9 C20 3 16 1 14 6" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
                        <circle cx="8" cy="13" r="1.5" fill="#0f172a" />
                        <circle cx="16" cy="13" r="1.5" fill="#0f172a" />
                        <path d="M10 16 C11 18 13 18 14 16" stroke="#334155" strokeWidth="1.3" fill="none" strokeLinecap="round" />
                      </g>
                    )}

                    {/* Trapped Tiger Warning Badge */}
                    {isTrappedTiger && (
                      <g transform={`translate(${pos.x + 8}, ${pos.y - 15})`}>
                        <circle cx="5" cy="5" r="7" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
                        <text x="5" y="8" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff">
                          ✕
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* Responsive Touch Hitbox */}
                <circle cx={pos.x} cy={pos.y} r="25" fill="transparent" className="cursor-pointer active:opacity-20" />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
