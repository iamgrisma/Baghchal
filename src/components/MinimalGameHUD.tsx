import React from 'react';
import { GamePhase, GameStatus, PlayerRole } from '../types';

interface MinimalGameHUDProps {
  turn: PlayerRole;
  phase: GamePhase;
  status: GameStatus;
  goatsInReserve: number;
  goatsCaptured: number;
  trappedTigersCount: number;
  gameMode: string;
  opponentName?: string;
  playerRole?: PlayerRole;
  isAiThinking?: boolean;
}

export const MinimalGameHUD: React.FC<MinimalGameHUDProps> = ({
  turn,
  phase,
  status,
  goatsInReserve,
  goatsCaptured,
  trappedTigersCount,
  gameMode,
  opponentName,
  playerRole,
  isAiThinking,
}) => {
  return (
    <div className="w-full max-w-xl mx-auto px-2 py-1 select-none">
      {/* Sleek, ultra-compact dual-stat HUD bar */}
      <div className="flex items-center justify-between gap-1 sm:gap-2 bg-stone-900/90 border border-stone-800/90 rounded-xl px-2.5 py-1.5 shadow-md text-xs">
        
        {/* Left: Tiger Attacks (Goats Eaten: X/5) */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 text-amber-400 font-bold text-[11px] sm:text-xs">
            <span>🐅</span>
            <span className="hidden xs:inline">Attacks:</span>
            <span className="font-mono text-stone-200">{goatsCaptured}/5</span>
          </div>
          {/* 5 mini dots representing goats hunted */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <span
                key={`eat-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i < goatsCaptured
                    ? 'bg-red-500 ring-1 ring-red-400 shadow-sm'
                    : 'bg-stone-800 border border-stone-700'
                }`}
                title={`Captured goat ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Center: Reserve Goats or Movement Phase */}
        <div className="flex items-center gap-1 text-[10px] sm:text-xs text-stone-400 font-medium px-1.5 py-0.5 rounded-md bg-stone-950/60 border border-stone-800/60">
          <span>🐐</span>
          {phase === 'placement' ? (
            <span>
              Reserve: <strong className="text-stone-200 font-mono">{goatsInReserve}</strong>
            </span>
          ) : (
            <span className="text-emerald-400 font-semibold text-[10px]">
              Movement
            </span>
          )}
        </div>

        {/* Right: Tiger Traps (Trapped Tigers: Y/4) */}
        <div className="flex items-center gap-1.5">
          {/* 4 mini dots representing trapped tigers */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <span
                key={`trap-${i}`}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i < trappedTigersCount
                    ? 'bg-emerald-400 ring-1 ring-emerald-300 shadow-sm'
                    : 'bg-stone-800 border border-stone-700'
                }`}
                title={`Trapped tiger ${i + 1}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 text-emerald-400 font-bold text-[11px] sm:text-xs">
            <span className="font-mono text-stone-200">{trappedTigersCount}/4</span>
            <span className="hidden xs:inline">Traps</span>
            <span>🕸️</span>
          </div>
        </div>
      </div>
    </div>
  );
};
