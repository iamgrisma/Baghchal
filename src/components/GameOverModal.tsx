import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Swords, Shield, RotateCcw, Eye } from 'lucide-react';
import { GameStatus, PlayerRole } from '../types';

interface GameOverModalProps {
  status: GameStatus;
  goatsCaptured: number;
  totalTurns: number;
  userRole?: PlayerRole;
  onPlayAgain: () => void;
  onReviewBoard: () => void;
  isOpen: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  status,
  goatsCaptured,
  totalTurns,
  userRole,
  onPlayAgain,
  onReviewBoard,
  isOpen,
}) => {
  useEffect(() => {
    if (isOpen && status !== 'playing') {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#d97706', '#10b981', '#3b82f6'],
        });
      } catch (e) {}
    }
  }, [isOpen, status]);

  if (!isOpen || status === 'playing') return null;

  const isTigerWon = status === 'tiger_won';
  const isUserWinner = userRole ? (isTigerWon ? userRole === 'tiger' : userRole === 'goat') : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm rounded-2xl border border-stone-800 bg-stone-900 p-6 text-center shadow-2xl text-stone-200 space-y-4">
        
        {/* Trophy / Emblem Icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-950/60 border border-amber-600/40 text-amber-400 shadow-inner">
          <Trophy className="w-9 h-9" />
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-black tracking-tight text-stone-100">
            {isTigerWon ? 'Tigers Victorious!' : 'Goats Victorious!'}
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            {isTigerWon
              ? `Tigers captured ${goatsCaptured} goats to achieve victory.`
              : 'Goats strategically immobilized all 4 tigers.'}
          </p>
        </div>

        {/* Match summary stats */}
        <div className="grid grid-cols-2 gap-2 bg-stone-950/80 p-3 rounded-xl border border-stone-800 text-xs">
          <div>
            <div className="text-stone-400">Total Moves</div>
            <div className="text-sm font-bold font-mono text-stone-200 mt-0.5">{totalTurns}</div>
          </div>
          <div>
            <div className="text-stone-400">Goats Eaten</div>
            <div className="text-sm font-bold font-mono text-amber-400 mt-0.5">{goatsCaptured} / 5</div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={onPlayAgain}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm shadow-md transition active:scale-98"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            onClick={onReviewBoard}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium text-xs transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Review Final Board</span>
          </button>
        </div>
      </div>
    </div>
  );
};
