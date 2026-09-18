import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Board, Move, PieceType, PlayerRole } from '../types';
import { getTigerMovesForPos, getTrappedTigersInfo } from '../game/rules';

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
}

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
}) => {
  // SVG Dimensions
  const SIZE = 500;
  const PADDING = 50;
  const STEP = (SIZE - 2 * PADDING) / 4; // 100px between points

  // Precalculate pixel coordinates for each of the 25 nodes
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

  // Which tigers are trapped
  const trappedInfo = useMemo(() => getTrappedTigersInfo(board), [board]);

  // Map of valid move destinations for currently selected piece or placement
  const validDestinationMap = useMemo(() => {
    const map = new Map<number, Move>();
    for (const m of validMoves) {
      map.set(m.to, m);
    }
    return map;
  }, [validMoves]);

  // If a jump capture is hovered/targeted, find the captured goat index
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
    <div className="relative w-full h-full aspect-square touch-none select-none flex items-center justify-center">
      {/* Board container with deep wood/brass tactile frame */}
      <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-stone-900 via-stone-925 to-stone-950 p-1.5 sm:p-2.5 shadow-2xl border-2 border-stone-800/80 ring-1 ring-amber-900/30 flex items-center justify-center">
        
        {/* Subtle Nepali brass corner inlays */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-600/60 rounded-tl-sm pointer-events-none" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-600/60 rounded-tr-sm pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-600/60 rounded-bl-sm pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-600/60 rounded-br-sm pointer-events-none" />

        {/* SVG Board Rendering */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Glow for selected pieces */}
            <filter id="goldGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.8" />
            </filter>
            <filter id="crimsonGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#ef4444" floodOpacity="0.8" />
            </filter>
            <filter id="pieceShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
            </filter>

            {/* Neon Outglows for last put goat or last moved piece */}
            <filter id="tigerNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#f59e0b" floodOpacity="0.95" />
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#fbbf24" floodOpacity="1" />
            </filter>

            <filter id="goatNeonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38bdf8" floodOpacity="0.95" />
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#bae6fd" floodOpacity="1" />
            </filter>

            {/* Attack Kill Move Claw Glow */}
            <filter id="killBloodGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#ef4444" floodOpacity="1" />
            </filter>

            {/* Gradients */}
            <linearGradient
              id="boardLineGrad"
              x1={PADDING}
              y1={PADDING}
              x2={SIZE - PADDING}
              y2={SIZE - PADDING}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#d97706" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#b45309" stopOpacity="0.95" />
            </linearGradient>

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

          {/* 1. Board Background Surface */}
          <rect
            x={PADDING - 14}
            y={PADDING - 14}
            width={SIZE - 2 * PADDING + 28}
            height={SIZE - 2 * PADDING + 28}
            rx="12"
            fill="#1c1917"
            stroke="#44403c"
            strokeWidth="1.5"
          />

          {/* 2. Traditional Baghchal Grid Lines */}
          {/* A. Dark Carved Recessed Groove Layer for depth and contrast */}
          <g stroke="#0c0a09" strokeWidth="4.5" strokeLinecap="round">
            {/* Outer groove border */}
            <rect
              x={PADDING}
              y={PADDING}
              width={SIZE - 2 * PADDING}
              height={SIZE - 2 * PADDING}
              fill="none"
            />
            {/* Horizontal Grooves */}
            {[1, 2, 3].map((r) => (
              <line
                key={`gh-${r}`}
                x1={PADDING}
                y1={PADDING + r * STEP}
                x2={SIZE - PADDING}
                y2={PADDING + r * STEP}
              />
            ))}
            {/* Vertical Grooves */}
            {[1, 2, 3].map((c) => (
              <line
                key={`gv-${c}`}
                x1={PADDING + c * STEP}
                y1={PADDING}
                x2={PADDING + c * STEP}
                y2={SIZE - PADDING}
              />
            ))}
            {/* Diagonals */}
            <line x1={PADDING} y1={PADDING} x2={SIZE - PADDING} y2={SIZE - PADDING} />
            <line x1={SIZE - PADDING} y1={PADDING} x2={PADDING} y2={SIZE - PADDING} />
            {/* Central Diamond */}
            <line x1={PADDING + 2 * STEP} y1={PADDING} x2={PADDING} y2={PADDING + 2 * STEP} />
            <line x1={PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={SIZE - PADDING} />
            <line x1={PADDING + 2 * STEP} y1={SIZE - PADDING} x2={SIZE - PADDING} y2={PADDING + 2 * STEP} />
            <line x1={SIZE - PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={PADDING} />
          </g>

          {/* B. Brass Inlay Grid Lines (High-contrast, vibrant, and always visible) */}
          <g stroke="#d97706" strokeWidth="2.5" strokeLinecap="round">
            {/* Outer Border Double Line */}
            <rect
              x={PADDING}
              y={PADDING}
              width={SIZE - 2 * PADDING}
              height={SIZE - 2 * PADDING}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="3.5"
            />

            {/* Inner Horizontal Grid Lines (Row 1, 2, 3) */}
            {[1, 2, 3].map((r) => (
              <line
                key={`h-${r}`}
                x1={PADDING}
                y1={PADDING + r * STEP}
                x2={SIZE - PADDING}
                y2={PADDING + r * STEP}
                stroke="#f59e0b"
              />
            ))}

            {/* Inner Vertical Grid Lines (Col 1, 2, 3) */}
            {[1, 2, 3].map((c) => (
              <line
                key={`v-${c}`}
                x1={PADDING + c * STEP}
                y1={PADDING}
                x2={PADDING + c * STEP}
                y2={SIZE - PADDING}
                stroke="#f59e0b"
              />
            ))}

            {/* Major Diagonals from corners */}
            <line x1={PADDING} y1={PADDING} x2={SIZE - PADDING} y2={SIZE - PADDING} stroke="#d97706" />
            <line x1={SIZE - PADDING} y1={PADDING} x2={PADDING} y2={SIZE - PADDING} stroke="#d97706" />

            {/* Central Diamond Lines connecting midpoints of outer edges */}
            <line x1={PADDING + 2 * STEP} y1={PADDING} x2={PADDING} y2={PADDING + 2 * STEP} stroke="#d97706" />
            <line x1={PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={SIZE - PADDING} stroke="#d97706" />
            <line x1={PADDING + 2 * STEP} y1={SIZE - PADDING} x2={SIZE - PADDING} y2={PADDING + 2 * STEP} stroke="#d97706" />
            <line x1={SIZE - PADDING} y1={PADDING + 2 * STEP} x2={PADDING + 2 * STEP} y2={PADDING} stroke="#d97706" />
          </g>

          {/* Last Move Trail Indicator & Killing Move Animation */}
          {lastMove && lastMove.from !== undefined && (
            <line
              x1={nodeCoords[lastMove.from].x}
              y1={nodeCoords[lastMove.from].y}
              x2={nodeCoords[lastMove.to].x}
              y2={nodeCoords[lastMove.to].y}
              stroke={lastMove.type === 'jump' ? '#ef4444' : '#eab308'}
              strokeWidth={lastMove.type === 'jump' ? '4.5' : '3'}
              strokeDasharray={lastMove.type === 'jump' ? '8 4' : '6 4'}
              strokeOpacity={lastMove.type === 'jump' ? '0.95' : '0.6'}
              filter={lastMove.type === 'jump' ? 'url(#killBloodGlow)' : undefined}
            />
          )}

          {/* Killing Move Claw Slash & Shockwave Animation */}
          {lastMove && lastMove.type === 'jump' && lastMove.captured !== undefined && (
            <g key={`kill-anim-${lastMove.from}-${lastMove.to}-${lastMove.captured}`}>
              {/* Expanding red shockwave circle on killed goat position */}
              <circle
                cx={nodeCoords[lastMove.captured].x}
                cy={nodeCoords[lastMove.captured].y}
                r="25"
                fill="rgba(239, 68, 68, 0.35)"
                stroke="#ef4444"
                strokeWidth="3"
                className="animate-ping"
              />

              {/* Fierce Crimson Claw Marks & Impact Flash */}
              <g transform={`translate(${nodeCoords[lastMove.captured].x}, ${nodeCoords[lastMove.captured].y})`}>
                <line
                  x1="-13"
                  y1="-15"
                  x2="-3"
                  y2="15"
                  stroke="#ef4444"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#killBloodGlow)"
                />
                <line
                  x1="-3"
                  y1="-17"
                  x2="7"
                  y2="13"
                  stroke="#dc2626"
                  strokeWidth="4"
                  strokeLinecap="round"
                  filter="url(#killBloodGlow)"
                />
                <line
                  x1="7"
                  y1="-14"
                  x2="17"
                  y2="14"
                  stroke="#991b1b"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#killBloodGlow)"
                />
                <circle cx="0" cy="0" r="7" fill="#fecaca" className="animate-pulse" />
                <text
                  x="0"
                  y="26"
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="900"
                  fill="#f87171"
                  className="tracking-wider uppercase drop-shadow"
                >
                  SLASH! 💥
                </text>
              </g>
            </g>
          )}

          {/* 3. Board Intersection Nodes & Touch Targets */}
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
                {/* Board Point Hardware Stud */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="5"
                  fill="#292524"
                  stroke="#78350f"
                  strokeWidth="1.5"
                />

                {/* Neon Outglow Halo Ring on Last Put Goat or Last Moved Tiger/Goat */}
                {isLastMoveDestination && !isSelected && (
                  <g>
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={piece === 'tiger' ? 27.5 : 24.5}
                      fill="none"
                      stroke={piece === 'tiger' ? '#f59e0b' : '#38bdf8'}
                      strokeWidth="2.5"
                      strokeDasharray="5 3"
                      filter={piece === 'tiger' ? 'url(#tigerNeonGlow)' : 'url(#goatNeonGlow)'}
                      className="animate-spin-slow"
                    />
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={piece === 'tiger' ? 24 : 21.5}
                      fill="none"
                      stroke={piece === 'tiger' ? '#fef08a' : '#bae6fd'}
                      strokeWidth="1.2"
                      opacity="0.8"
                    />
                  </g>
                )}

                {/* Valid Move Destination Target Indicator */}
                {isTarget && (
                  <g className="transition-transform duration-150 hover:scale-110">
                    {phase === 'placement' ? (
                      /* Clean placement target ring & amber point */
                      <>
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="11"
                          fill="rgba(245, 158, 11, 0.16)"
                          stroke="#f59e0b"
                          strokeWidth="1.5"
                          strokeDasharray="3 2"
                        />
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r="4.5"
                          fill="#fbbf24"
                        />
                      </>
                    ) : (
                      /* Active movement destination pulse */
                      <>
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isJumpTarget ? 21 : 16}
                          fill={isJumpTarget ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)'}
                          stroke={isJumpTarget ? '#ef4444' : '#f59e0b'}
                          strokeWidth={isJumpTarget ? 2.5 : 2}
                          className="animate-pulse"
                        />
                        <circle
                          cx={pos.x}
                          cy={pos.y}
                          r={isJumpTarget ? 7 : 5}
                          fill={isJumpTarget ? '#ef4444' : '#fbbf24'}
                        />
                      </>
                    )}
                    {/* Attack icon if jump */}
                    {isJumpTarget && (
                      <text
                        x={pos.x}
                        y={pos.y + 3.5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#ffffff"
                        pointerEvents="none"
                      >
                        ⚡
                      </text>
                    )}
                  </g>
                )}

                {/* Piece Rendering: Tiger (Bigger 🐯) or Goat (Bigger 🐐) with Neon Outglow */}
                {piece && (
                  <g
                    filter={
                      isSelected
                        ? 'url(#goldGlow)'
                        : isCapturedGoat
                        ? 'url(#crimsonGlow)'
                        : isLastMoveDestination
                        ? piece === 'tiger'
                          ? 'url(#tigerNeonGlow)'
                          : 'url(#goatNeonGlow)'
                        : 'url(#pieceShadow)'
                    }
                  >
                    {/* Piece Outer Shell - Larger Tiger & Goat */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={piece === 'tiger' ? 23.5 : 20.5}
                      fill={piece === 'tiger' ? 'url(#tigerGrad)' : 'url(#goatGrad)'}
                      stroke={
                        isSelected
                          ? '#fde047'
                          : isCapturedGoat
                          ? '#ef4444'
                          : isLastMoveDestination
                          ? piece === 'tiger'
                            ? '#f59e0b'
                            : '#38bdf8'
                          : piece === 'tiger'
                          ? '#78350f'
                          : '#475569'
                      }
                      strokeWidth={isSelected ? 3.5 : isLastMoveDestination ? 3 : 2}
                      className="transition-transform duration-150"
                    />

                    {/* Formidable Large Tiger Graphics 🐯 */}
                    {piece === 'tiger' && (
                      <g transform={`translate(${pos.x - 14}, ${pos.y - 14}) scale(1.18)`}>
                        {/* Tiger Face & Ears Motif */}
                        <path
                          d="M4 6 C2 1 6 0 8 4 Z"
                          fill="#451a03"
                        />
                        <path
                          d="M20 6 C22 1 18 0 16 4 Z"
                          fill="#451a03"
                        />
                        {/* Inner Ear Highlights */}
                        <polygon points="5,4 7,3 6,5" fill="#f59e0b" />
                        <polygon points="19,4 17,3 18,5" fill="#f59e0b" />
                        {/* Fierce Amber Eyes */}
                        <circle cx="8" cy="11" r="1.8" fill="#fef08a" />
                        <circle cx="16" cy="11" r="1.8" fill="#fef08a" />
                        <circle cx="8" cy="11" r="0.8" fill="#451a03" />
                        <circle cx="16" cy="11" r="0.8" fill="#451a03" />
                        {/* Nose & Whiskers */}
                        <polygon points="12,14 9.5,12 14.5,12" fill="#451a03" />
                        <path
                          d="M9 16 C11 17.5 13 17.5 15 16"
                          stroke="#451a03"
                          strokeWidth="1.4"
                          fill="none"
                          strokeLinecap="round"
                        />
                        {/* Whiskers */}
                        <line x1="7" y1="13" x2="3" y2="12" stroke="#451a03" strokeWidth="0.9" />
                        <line x1="7" y1="15" x2="3" y2="16" stroke="#451a03" strokeWidth="0.9" />
                        <line x1="17" y1="13" x2="21" y2="12" stroke="#451a03" strokeWidth="0.9" />
                        <line x1="17" y1="15" x2="21" y2="16" stroke="#451a03" strokeWidth="0.9" />
                        {/* Tiger Forehead Stripes */}
                        <line x1="12" y1="4.5" x2="12" y2="8" stroke="#451a03" strokeWidth="1.6" />
                        <line x1="8.5" y1="6" x2="11" y2="8" stroke="#451a03" strokeWidth="1.3" />
                        <line x1="15.5" y1="6" x2="13" y2="8" stroke="#451a03" strokeWidth="1.3" />
                      </g>
                    )}

                    {/* Refined Large Goat Graphics 🐐 */}
                    {piece === 'goat' && (
                      <g transform={`translate(${pos.x - 13}, ${pos.y - 13}) scale(1.1)`}>
                        {/* Curved Horns */}
                        <path
                          d="M6 9 C4 3 8 1 10 6"
                          stroke="#1e293b"
                          strokeWidth="2.2"
                          fill="none"
                          strokeLinecap="round"
                        />
                        <path
                          d="M18 9 C20 3 16 1 14 6"
                          stroke="#1e293b"
                          strokeWidth="2.2"
                          fill="none"
                          strokeLinecap="round"
                        />
                        {/* Eyes */}
                        <circle cx="8" cy="13" r="1.6" fill="#0f172a" />
                        <circle cx="16" cy="13" r="1.6" fill="#0f172a" />
                        <circle cx="8.3" cy="12.7" r="0.5" fill="#ffffff" />
                        <circle cx="16.3" cy="12.7" r="0.5" fill="#ffffff" />
                        {/* Muzzle */}
                        <path
                          d="M10 16 C11 18.5 13 18.5 14 16"
                          stroke="#334155"
                          strokeWidth="1.5"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </g>
                    )}

                    {/* Trapped Tiger Warning Badge */}
                    {isTrappedTiger && (
                      <g transform={`translate(${pos.x + 9}, ${pos.y - 16})`}>
                        <circle cx="5" cy="5" r="7.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.4" />
                        <text
                          x="5"
                          y="8.5"
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="900"
                          fill="#ffffff"
                        >
                          ✕
                        </text>
                      </g>
                    )}

                    {/* Targeted for capture danger icon */}
                    {isCapturedGoat && (
                      <g transform={`translate(${pos.x + 7}, ${pos.y - 14})`}>
                        <circle cx="5" cy="5" r="7" fill="#dc2626" stroke="#fef2f2" strokeWidth="1.2" />
                        <text
                          x="5"
                          y="8"
                          textAnchor="middle"
                          fontSize="9"
                          fill="#ffffff"
                        >
                          !
                        </text>
                      </g>
                    )}
                  </g>
                )}

                {/* Large Transparent Hitbox for Touch Precision on Mobile */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="26"
                  fill="transparent"
                  className="cursor-pointer active:opacity-20"
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
