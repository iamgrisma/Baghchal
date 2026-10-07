import React, { useState } from 'react';
import {
  X,
  Volume2,
  VolumeX,
  RotateCcw,
  BookOpen,
  Trophy,
  User,
  Wifi,
  History,
  Palette,
  LogOut,
  Flag,
  AlertTriangle,
} from 'lucide-react';
import { BoardTheme, GameMode } from '../types';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: GameMode;
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  onResignMatch?: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  boardTheme: BoardTheme;
  onSelectTheme: (theme: BoardTheme) => void;
  onOpenRules: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
  onOpenOnlineLobby: () => void;
  onOpenLedger: () => void;
  onExitToSetup: () => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  mode,
  canUndo,
  onUndo,
  onRestart,
  onResignMatch,
  isMuted,
  onToggleSound,
  boardTheme,
  onSelectTheme,
  onOpenRules,
  onOpenLeaderboard,
  onOpenProfile,
  onOpenOnlineLobby,
  onOpenLedger,
  onExitToSetup,
}) => {
  const [showResignConfirm, setShowResignConfirm] = useState(false);

  if (!isOpen) return null;

  const handleResign = () => {
    setShowResignConfirm(false);
    onClose();
    onResignMatch?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-xs h-full bg-stone-950 border-l border-stone-800 flex flex-col justify-between shadow-2xl text-stone-200 p-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-stone-950 font-black text-xs">
              B
            </div>
            <span className="font-bold text-sm tracking-wide text-stone-100">Baghchal Menu</span>
          </div>

          <button
            onClick={() => {
              setShowResignConfirm(false);
              onClose();
            }}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {/* Match Actions */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase px-1">
              Match Controls
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenLedger();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition"
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>Match Move History (Ledger)</span>
            </button>

            {/* In ONLINE mode, NO unilateral restart! Instead offer Resign Match */}
            {mode === 'online' ? (
              showResignConfirm ? (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>Concede match to opponent?</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleResign}
                      className="py-1.5 bg-red-600 hover:bg-red-500 text-stone-100 rounded-lg text-xs font-bold transition"
                    >
                      Yes, Resign
                    </button>
                    <button
                      onClick={() => setShowResignConfirm(false)}
                      className="py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-xs font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowResignConfirm(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-amber-300 hover:text-amber-200 text-xs font-semibold transition"
                >
                  <Flag className="w-4 h-4 text-red-400" />
                  <span>Resign Match</span>
                </button>
              )
            ) : (
              /* Local / AI mode: Standard Restart */
              <button
                onClick={() => {
                  onRestart();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-semibold transition"
              >
                <RotateCcw className="w-4 h-4 text-stone-400" />
                <span>Restart Match</span>
              </button>
            )}

            {mode === 'online' && (
              <button
                onClick={() => {
                  onClose();
                  onOpenOnlineLobby();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-semibold transition"
              >
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>Online Matchmaking</span>
              </button>
            )}
          </div>

          {/* Preferences */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase px-1">
              Preferences
            </div>

            <button
              onClick={onToggleSound}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-semibold transition"
            >
              <div className="flex items-center gap-2.5">
                {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>Sound Audio</span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono">{isMuted ? 'Muted' : 'On'}</span>
            </button>

            {/* Board Themes */}
            <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-300">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>Board Theme</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {(['classic', 'slate', 'midnight'] as BoardTheme[]).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => onSelectTheme(theme)}
                    className={`py-1 text-[10px] font-bold rounded-lg border transition capitalize ${
                      boardTheme === theme
                        ? 'bg-amber-500 text-stone-950 border-amber-400'
                        : 'bg-stone-850 text-stone-400 border-stone-750 hover:text-stone-200'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Records & Guides */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-semibold tracking-wider text-stone-400 uppercase px-1">
              Community & Records
            </div>

            <button
              onClick={() => {
                onClose();
                onOpenLeaderboard();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-semibold transition"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Leaderboard</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenProfile();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-semibold transition"
            >
              <User className="w-4 h-4 text-sky-400" />
              <span>Profile & Statistics</span>
            </button>

            <button
              onClick={() => {
                onClose();
                onOpenRules();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-semibold transition"
            >
              <BookOpen className="w-4 h-4 text-stone-400" />
              <span>Rules of Baghchal</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-stone-800 space-y-2">
          <button
            onClick={() => {
              onClose();
              onExitToSetup();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-850 border border-stone-800 text-red-300 text-xs font-bold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Leave Match / Exit</span>
          </button>
          <div className="text-center text-[10px] text-stone-400">
            Version 1.1.4 · Cross-Platform Edition
          </div>
        </div>
      </div>
    </div>
  );
};
