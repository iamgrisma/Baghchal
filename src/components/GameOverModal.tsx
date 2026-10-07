import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, Swords, RotateCcw, Eye, Award, Check, X, LogOut, Clock, RefreshCw } from 'lucide-react';
import { GameStatus, PlayerRole, RematchStatus } from '../types';

interface GameOverModalProps {
  isOpen: boolean;
  status: GameStatus;
  goatsCaptured?: number;
  totalTurns?: number;
  userRole?: PlayerRole;
  isOnline?: boolean;
  rematchStatus?: RematchStatus;
  forfeitDetail?: string | null;
  onRequestRematch?: () => void;
  onAcceptRematch?: () => void;
  onDeclineRematch?: () => void;
  onPlayAgain: () => void;
  onReviewBoard: () => void;
  onChangeMode?: () => void;
  onOpenLeaderboard?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  status,
  goatsCaptured = 0,
  totalTurns = 0,
  userRole,
  isOnline = false,
  rematchStatus = 'idle',
  forfeitDetail,
  onRequestRematch,
  onAcceptRematch,
  onDeclineRematch,
  onPlayAgain,
  onReviewBoard,
  onChangeMode,
  onOpenLeaderboard,
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
  const isGoatWon = status === 'goat_won';
  const isUserWinner = userRole ? (isTigerWon ? userRole === 'tiger' : userRole === 'goat') : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-sm rounded-2xl border border-stone-800 bg-stone-900 p-6 text-center shadow-2xl text-stone-200 space-y-4">
        {/* Trophy / Emblem Icon */}
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border shadow-inner ${
            isUserWinner
              ? 'bg-amber-950/60 border-amber-600/40 text-amber-400'
              : 'bg-stone-850 border-stone-750 text-stone-400'
          }`}
        >
          <Trophy className="w-9 h-9" />
        </div>

        {/* Title */}
        <div>
          <h2 className="text-xl font-black tracking-tight text-stone-100">
            {isTigerWon ? '🐅 Tigers Victorious!' : '🐐 Goats Victorious!'}
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            {forfeitDetail ? (
              <span className="text-amber-300 font-medium">{forfeitDetail}</span>
            ) : isTigerWon ? (
              `Tigers captured ${goatsCaptured} goats to achieve victory.`
            ) : (
              'Goats strategically immobilized all 4 tigers.'
            )}
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

        {/* Rematch Notification Banners */}
        {isOnline && rematchStatus === 'requested_by_me' && (
          <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs flex items-center justify-center gap-2 animate-pulse">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Rematch requested. Waiting for opponent to accept...</span>
          </div>
        )}

        {isOnline && rematchStatus === 'requested_by_opponent' && (
          <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-400 shrink-0 animate-spin-slow" />
            <span className="font-semibold">Opponent requested a rematch!</span>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2">
          {/* ONLINE MODE BUTTONS */}
          {isOnline ? (
            <>
              {rematchStatus === 'requested_by_opponent' ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onAcceptRematch}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-950 font-bold text-xs shadow-md transition active:scale-98"
                  >
                    <Check className="w-4 h-4" />
                    <span>Accept Rematch</span>
                  </button>
                  <button
                    onClick={onDeclineRematch || onChangeMode}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold text-xs border border-stone-700 transition active:scale-98"
                  >
                    <X className="w-4 h-4" />
                    <span>Decline & Exit</span>
                  </button>
                </div>
              ) : rematchStatus === 'requested_by_me' ? (
                <button
                  onClick={onDeclineRematch || onChangeMode}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 font-bold text-xs border border-stone-700 transition active:scale-98"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel Request & Exit</span>
                </button>
              ) : (
                <button
                  onClick={onRequestRematch}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm shadow-md transition active:scale-98"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Request Rematch (Replay)</span>
                </button>
              )}

              <button
                onClick={onChangeMode}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 font-semibold text-xs border border-stone-750 transition"
              >
                <LogOut className="w-3.5 h-3.5 text-stone-400" />
                <span>Exit to Main Menu</span>
              </button>
            </>
          ) : (
            /* LOCAL / AI MODE BUTTONS */
            <>
              <button
                onClick={onPlayAgain}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm shadow-md transition active:scale-98"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>

              {onOpenLeaderboard && (
                <button
                  onClick={onOpenLeaderboard}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-amber-300 font-bold text-xs border border-amber-600/30 transition active:scale-98 shadow-sm"
                >
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>View Leaderboard</span>
                </button>
              )}

              {onChangeMode && (
                <button
                  onClick={onChangeMode}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-stone-850 hover:bg-stone-800 text-stone-300 font-semibold text-xs border border-stone-750 transition"
                >
                  <Swords className="w-3.5 h-3.5" />
                  <span>Change Mode & Level</span>
                </button>
              )}
            </>
          )}

          {/* Review Board */}
          <button
            onClick={onReviewBoard}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-400 hover:text-stone-300 font-medium text-xs transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Review Final Board</span>
          </button>
        </div>
      </div>
    </div>
  );
};
