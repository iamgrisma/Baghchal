import React from 'react';
import { Play, BookOpen, Trophy, Bot, Globe, Users, Sliders, Box, Layers } from 'lucide-react';
import { BoardDimension, BoardTheme, GameMode } from '../types';
import { TigerIcon, GoatIcon } from './GameIcons';

interface SplashScreenProps {
  mode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  boardDimension: BoardDimension;
  onSelectDimension: (dim: BoardDimension) => void;
  boardTheme: BoardTheme;
  onSelectTheme: (theme: BoardTheme) => void;
  onStartClick: () => void;
  onConfigureClick: () => void;
  onOpenRules: () => void;
  onOpenProfile: () => void;
  isTelegram: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  mode,
  onSelectMode,
  boardDimension,
  onSelectDimension,
  boardTheme,
  onSelectTheme,
  onStartClick,
  onConfigureClick,
  onOpenRules,
  onOpenProfile,
}) => {
  return (
    <div
      className="fixed inset-0 w-full h-full h-[100dvh] max-h-[100dvh] flex flex-col justify-between items-center bg-stone-950 text-stone-100 overflow-y-auto select-none touch-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Top App Bar Header */}
      <header className="w-full max-w-md h-14 px-4 flex items-center justify-between shrink-0 border-b border-stone-900 bg-stone-950/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-black text-xs shadow-sm">
            B
          </div>
          <span className="font-bold text-sm tracking-wide text-stone-200">BAGHCHAL</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenProfile}
            className="w-9 h-9 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 bg-stone-900/60 border border-stone-800/60 active:scale-95 transition"
            title="Records"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={onOpenRules}
            className="w-9 h-9 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 bg-stone-900/60 border border-stone-800/60 active:scale-95 transition"
            title="Rules"
          >
            <BookOpen className="w-4 h-4 text-stone-300" />
          </button>
        </div>
      </header>

      {/* Main Material Hero Surface */}
      <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center text-center px-4 py-3 z-10 gap-3">
        {/* Title Typography & Icon Crest */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-sm">
            <TigerIcon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-black tracking-tight text-stone-100 leading-none">
              Baghchal
            </h1>
            <p className="text-[11px] font-semibold text-amber-400 tracking-wide mt-0.5">
              Authentic Strategic Board Game
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-200/10 border border-slate-200/30 flex items-center justify-center text-slate-200 shadow-sm">
            <GoatIcon className="w-5 h-5" />
          </div>
        </div>

        {/* 1. PRIMARY GAME MODE SELECTOR */}
        <div className="w-full bg-stone-900/70 border border-stone-800 rounded-2xl p-2.5 space-y-1.5 shadow-md">
          <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400 text-left px-1">
            1. Select Game Mode
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => onSelectMode('ai')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition ${
                mode === 'ai'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                  : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Bot className="w-4 h-4 mb-0.5" />
              <span>VS AI</span>
            </button>

            <button
              onClick={() => onSelectMode('online')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition ${
                mode === 'online'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                  : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Globe className="w-4 h-4 mb-0.5" />
              <span>Online</span>
            </button>

            <button
              onClick={() => onSelectMode('local')}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-xs font-bold transition ${
                mode === 'local'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                  : 'bg-stone-950/60 border-stone-800 text-stone-300 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Users className="w-4 h-4 mb-0.5" />
              <span>Pass & Play</span>
            </button>
          </div>
        </div>

        {/* 2. BOARD PERSPECTIVE SELECTOR (2D vs 3D) */}
        <div className="w-full bg-stone-900/70 border border-stone-800 rounded-2xl p-2.5 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">
            <span>2. Choose Perspective</span>
            <span className="text-[10px] text-amber-400/90 font-medium lowercase">cross-compatible in multiplayer</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onSelectDimension('2d')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition ${
                boardDimension === '2d'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                  : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2D Tactical Board</span>
            </button>

            <button
              onClick={() => onSelectDimension('3d')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition ${
                boardDimension === '3d'
                  ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                  : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>3D WebGL Map</span>
            </button>
          </div>
        </div>

        {/* 3. 3D MAP & BOARD THEME SELECTOR */}
        <div className="w-full bg-stone-900/70 border border-stone-800 rounded-2xl p-2.5 space-y-1.5 shadow-md">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">
            <span>3. Board Map & Theme</span>
            {boardTheme === 'stone' && (
              <span className="text-[10px] text-amber-400 font-semibold lowercase">engraved stone active</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'stone', label: 'Engraved Stone', color: 'bg-stone-300' },
              { id: 'cathedral3d', label: 'Cathedral 3D', color: 'bg-violet-400', force3d: true },
              { id: 'slate', label: 'Highland Slate', color: 'bg-cyan-400' },
              { id: 'classic', label: 'Woodland Walnut', color: 'bg-amber-500' },
              { id: 'midnight', label: 'Obsidian Runic', color: 'bg-purple-400' },
            ].map(({ id, label, color, force3d }) => {
              const isSelected = boardTheme === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onSelectTheme(id as BoardTheme);
                    if (force3d) {
                      onSelectDimension('3d');
                    }
                  }}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border text-[11px] font-semibold transition ${
                    isSelected
                      ? 'bg-stone-900 border-amber-400 text-amber-300 ring-1 ring-amber-400/40 shadow-sm'
                      : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-200'
                  }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full ${color} mb-1 shadow-sm`} />
                  <span className="truncate max-w-full">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2 mt-1">
          <button
            id="splash-play-button"
            onClick={onStartClick}
            className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-black text-sm tracking-wide shadow-xl transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-stone-950" />
            <span>Play Match ({mode === 'ai' ? 'VS AI' : mode === 'online' ? 'Online' : 'Local'})</span>
          </button>

          <button
            onClick={onConfigureClick}
            className="w-full py-2 text-xs font-semibold text-stone-400 hover:text-stone-200 transition flex items-center justify-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-stone-400" />
            <span>Advanced Match Rules, Clock & Factions</span>
          </button>
        </div>
      </main>

      {/* Footer System Info */}
      <footer className="w-full max-w-md shrink-0 text-center text-[10px] text-stone-500 py-2 border-t border-stone-900">
        Baghchal Native Edition · 2D & 3D Engraved Board
      </footer>
    </div>
  );
};
