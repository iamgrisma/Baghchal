import React from 'react';
import {
  X,
  RotateCcw,
  RefreshCw,
  Volume2,
  VolumeX,
  Trophy,
  BookOpen,
  Palette,
  LogOut,
  Globe,
  SlidersHorizontal,
  User,
} from 'lucide-react';
import { BoardTheme, GameMode } from '../types';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: GameMode;
  canUndo: boolean;
  onUndo: () => void;
  onRestart: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  boardTheme: BoardTheme;
  onSelectTheme: (theme: BoardTheme) => void;
  onOpenRules: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
  onOpenOnlineLobby: () => void;
  onExitToSetup: () => void;
}

export const SideDrawer: React.FC<SideDrawerProps> = ({
  isOpen,
  onClose,
  mode,
  canUndo,
  onUndo,
  onRestart,
  isMuted,
  onToggleSound,
  boardTheme,
  onSelectTheme,
  onOpenRules,
  onOpenLeaderboard,
  onOpenProfile,
  onOpenOnlineLobby,
  onExitToSetup,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm select-none animate-fade-in">
      {/* Backdrop tap to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Slide-out Menu Panel */}
      <aside className="w-full max-w-xs h-full bg-stone-900 border-l border-stone-800 flex flex-col justify-between shadow-2xl p-4 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              B
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-100">Match Menu</h2>
              <span className="text-[10px] text-stone-400">Settings & Options</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Sections */}
        <div className="space-y-4 my-auto py-2">
          {/* Section 1: Gameplay Controls */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
              Actions
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onUndo();
                  onClose();
                }}
                disabled={!canUndo}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-semibold border transition ${
                  canUndo
                    ? 'bg-stone-950 border-stone-800 text-stone-200 hover:bg-stone-800'
                    : 'bg-stone-950/40 border-stone-900 text-stone-600 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Undo</span>
              </button>

              <button
                onClick={() => {
                  onRestart();
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-800 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Restart</span>
              </button>
            </div>
          </div>

          {/* Section 2: Mode & Multiplayer */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
              Game Mode
            </div>
            <div className="space-y-1.5">
              {mode === 'online' ? (
                <button
                  onClick={() => {
                    onOpenOnlineLobby();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-sky-800/60 text-xs font-semibold text-sky-300 hover:bg-stone-800 transition"
                >
                  <span className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-sky-400" />
                    <span>Online Room Info</span>
                  </span>
                  <span className="text-[10px] text-sky-400">Manage</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onExitToSetup();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-800 transition"
                >
                  <span className="flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                    <span>Change Game Setup</span>
                  </span>
                  <span className="text-[10px] text-stone-400 capitalize">{mode}</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Audio & Themes */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
              Audio & Visuals
            </div>

            <button
              onClick={onToggleSound}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-800 transition"
            >
              <span className="flex items-center gap-2">
                {isMuted ? <VolumeX className="w-4 h-4 text-stone-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
                <span>Game Audio</span>
              </span>
              <span className={`text-[10px] font-bold ${isMuted ? 'text-stone-500' : 'text-emerald-400'}`}>
                {isMuted ? 'Off' : 'On'}
              </span>
            </button>

            <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-stone-300 font-semibold">
                <Palette className="w-3.5 h-3.5 text-amber-400" />
                <span>Board Theme</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'classic', label: 'Woodland', color: 'bg-amber-500' },
                  { id: 'slate', label: 'Highland', color: 'bg-cyan-400' },
                  { id: 'midnight', label: 'Obsidian', color: 'bg-purple-400' },
                ].map(({ id, label, color }) => (
                  <button
                    key={id}
                    onClick={() => onSelectTheme(id as BoardTheme)}
                    className={`py-1.5 rounded-lg text-[10px] font-semibold border flex flex-col items-center gap-1 transition ${
                      boardTheme === id
                        ? 'bg-stone-900 border-amber-400 text-stone-100 ring-1 ring-amber-400/50'
                        : 'bg-stone-900/60 border-stone-800 text-stone-400'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4: Rules & Records */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-1">
              Information
            </div>
            <div className="space-y-1.5">
              <button
                onClick={() => {
                  onOpenRules();
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-800 transition"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>How to Play</span>
                </span>
                <span className="text-[10px] text-stone-500">Rules</span>
              </button>

              <button
                onClick={() => {
                  onOpenLeaderboard();
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-800 transition"
              >
                <span className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Leaderboard</span>
                </span>
                <span className="text-[10px] text-amber-400">Ranks</span>
              </button>

              <button
                onClick={() => {
                  onOpenProfile();
                  onClose();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs font-semibold text-stone-200 hover:bg-stone-800 transition"
              >
                <span className="flex items-center gap-2">
                  <User className="w-4 h-4 text-stone-400" />
                  <span>My Profile</span>
                </span>
                <span className="text-[10px] text-stone-500">Stats</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer: Exit Match */}
        <div className="pt-3 border-t border-stone-800">
          <button
            onClick={() => {
              onExitToSetup();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/60 text-xs font-bold text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Exit Match to Menu</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
