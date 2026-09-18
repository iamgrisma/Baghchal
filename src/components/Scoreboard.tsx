import React from 'react';
import { GamePhase, GameStatus, PlayerRole } from '../types';
import { Shield, Swords, Lock, Trophy } from 'lucide-react';

interface ScoreboardProps {
  turn: PlayerRole;
  phase: GamePhase;
  status: GameStatus;
  goatsInReserve: number;
  goatsCaptured: number; // 0 to 5
  trappedTigersCount: number; // 0 to 4
  gameMode: string;
  opponentName?: string;
  playerRole?: PlayerRole; // if vs AI or online
}

export const Scoreboard: React.FC<ScoreboardProps> = ({
  turn,
  phase,
  status,
  goatsInReserve,
  goatsCaptured,
  trappedTigersCount,
  gameMode,
  opponentName,
  playerRole,
}) => {
  const isGameOver = status !== 'playing';

  return (
    <div id="game-scoreboard" className="w-full max-w-xl mx-auto px-1 sm:px-2 mb-1 sm:mb-2">
      {/* Turn & Status Banner */}
      <div className="relative overflow-hidden rounded-xl border border-stone-800 bg-stone-900/90 p-2 sm:p-3 shadow-lg backdrop-blur-md">
        
        {/* Top bar: Mode & Turn badge */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-stone-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              {gameMode === 'ai' && 'Vs AI Opponent'}
              {gameMode === 'local' && 'Local Pass & Play'}
              {gameMode === 'online' && `Online vs ${opponentName || 'Player'}`}
            </span>
            {playerRole && (
              <span className="rounded-full bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-300">
                You: {playerRole === 'goat' ? 'Goat' : 'Tiger'}
              </span>
            )}
          </div>

          {/* Turn badge */}
          {!isGameOver ? (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-sm ${
                turn === 'goat'
                  ? 'bg-slate-200 text-slate-900 ring-2 ring-slate-400/50'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 ring-2 ring-amber-400/50'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
              <span>{turn === 'goat' ? "Goat's Turn" : "Tiger's Turn"}</span>
            </div>
          ) : (
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white shadow-md ${
                status === 'goat_won' ? 'bg-emerald-600 ring-2 ring-emerald-400' : 'bg-amber-600 ring-2 ring-amber-400'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>{status === 'goat_won' ? 'Goats Victorious!' : 'Tigers Victorious!'}</span>
            </div>
          )}
        </div>

        {/* Dual Progress Gauges: Tiger Goal vs Goat Goal */}
        <div className="grid grid-cols-2 gap-3 pt-2.5">
          
          {/* Tigers' Progress: Goats Captured (Target: 5) */}
          <div className="rounded-lg bg-stone-950/60 p-2 border border-stone-800/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Swords className="w-3.5 h-3.5 text-amber-500" /> Tigers' Attack
              </span>
              <span className="text-[11px] font-mono text-stone-400">
                {goatsCaptured} / 5 Captured
              </span>
            </div>

            {/* 5 Slots indicator */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4].map((slot) => {
                const isCaptured = slot < goatsCaptured;
                return (
                  <div
                    key={`slot-${slot}`}
                    className={`flex-1 h-3 rounded-full transition-all duration-300 border ${
                      isCaptured
                        ? 'bg-gradient-to-r from-red-600 to-amber-600 border-red-500 shadow-sm shadow-red-900/50'
                        : 'bg-stone-900 border-stone-800'
                    }`}
                    title={isCaptured ? 'Goat captured' : 'Target goat slot'}
                  />
                );
              })}
            </div>
          </div>

          {/* Goats' Progress: Tigers Trapped (Target: 4) */}
          <div className="rounded-lg bg-stone-950/60 p-2 border border-stone-800/60 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 text-slate-300 font-semibold">
                <Lock className="w-3.5 h-3.5 text-slate-400" /> Goats' Trap
              </span>
              <span className="text-[11px] font-mono text-stone-400">
                {trappedTigersCount} / 4 Trapped
              </span>
            </div>

            {/* 4 Slots indicator */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((slot) => {
                const isTrapped = slot < trappedTigersCount;
                return (
                  <div
                    key={`trap-${slot}`}
                    className={`flex-1 h-3 rounded-full transition-all duration-300 border ${
                      isTrapped
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-400 shadow-sm shadow-emerald-900/50'
                        : 'bg-stone-900 border-stone-800'
                    }`}
                    title={isTrapped ? 'Tiger trapped' : 'Free tiger'}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Phase Subtext */}
        <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-amber-500/80" />
            <span>
              {phase === 'placement'
                ? `Placement Phase: ${goatsInReserve} goats in reserve`
                : 'Movement Phase: All 20 goats deployed'}
            </span>
          </div>
          <span className="text-stone-500">Baghchal 5x5</span>
        </div>
      </div>
    </div>
  );
};
