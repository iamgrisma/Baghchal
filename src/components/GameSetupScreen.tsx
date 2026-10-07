import React from 'react';
import { ArrowLeft, Bot, Globe, Users, Play, BookOpen, Zap, TrendingUp, Clock, Palette } from 'lucide-react';
import { AIDifficulty, BoardTheme, GameMode, PlayerProfile, PlayerRole, TimerMode } from '../types';
import { getAdaptiveAIDetails } from '../game/ai';

interface GameSetupScreenProps {
  mode: GameMode;
  aiUserRole: PlayerRole;
  difficulty: AIDifficulty;
  boardTheme: BoardTheme;
  timerMode: TimerMode;
  profile?: PlayerProfile;
  onSelectMode: (mode: GameMode) => void;
  onSelectAIRole: (role: PlayerRole) => void;
  onSelectDifficulty: (difficulty: AIDifficulty) => void;
  onSelectTheme: (theme: BoardTheme) => void;
  onSelectTimer: (timer: TimerMode) => void;
  onStartGame: () => void;
  onBackToSplash: () => void;
  onOpenRules: () => void;
}

export const GameSetupScreen: React.FC<GameSetupScreenProps> = ({
  mode,
  aiUserRole,
  difficulty,
  boardTheme,
  timerMode,
  profile,
  onSelectMode,
  onSelectAIRole,
  onSelectDifficulty,
  onSelectTheme,
  onSelectTimer,
  onStartGame,
  onBackToSplash,
  onOpenRules,
}) => {
  const adaptiveDetails = getAdaptiveAIDetails(profile);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-stone-950 text-stone-100 px-4 py-4 select-none overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between z-10 pb-2 border-b border-stone-800/80">
        <button
          id="setup-back-btn"
          onClick={onBackToSplash}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-amber-400 text-xs font-semibold border border-stone-800 transition"
          aria-label="Back to Splash"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="text-center">
          <h2 className="text-sm font-black tracking-wider text-amber-400 uppercase">
            Game Setup
          </h2>
          <p className="text-[10px] text-stone-400">Configure your match</p>
        </div>

        <button
          onClick={onOpenRules}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 text-xs font-medium border border-stone-800 transition"
          title="Game Rules"
        >
          <BookOpen className="w-4 h-4" />
        </button>
      </header>

      {/* Main Setup Controls */}
      <main className="w-full max-w-md flex flex-col gap-4 my-auto py-3 z-10">
        {/* Section 1: Modes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Game Mode</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              id="mode-vs-ai"
              type="button"
              onClick={() => onSelectMode('ai')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all text-center gap-1 ${
                mode === 'ai'
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/40 shadow-lg'
                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${mode === 'ai' ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'}`}>
                <Bot className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold leading-tight">vs AI</span>
              <span className="text-[9px] text-stone-500">Computer</span>
            </button>

            <button
              id="mode-online"
              type="button"
              onClick={() => onSelectMode('online')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all text-center gap-1 ${
                mode === 'online'
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300 ring-2 ring-sky-500/40 shadow-lg'
                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${mode === 'online' ? 'bg-sky-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'}`}>
                <Globe className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold leading-tight">Online</span>
              <span className="text-[9px] text-stone-500">Multiplayer</span>
            </button>

            <button
              id="mode-local"
              type="button"
              onClick={() => onSelectMode('local')}
              className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all text-center gap-1 ${
                mode === 'local'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 shadow-lg'
                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className={`p-1.5 rounded-xl ${mode === 'local' ? 'bg-emerald-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'}`}>
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold leading-tight">Friend</span>
              <span className="text-[9px] text-stone-500">Same Device</span>
            </button>
          </div>
        </div>

        {/* Section 2: Faction Selection */}
        {mode !== 'local' && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Play as</span>
              </span>
              <span className="text-[10px] text-stone-500">Choose your side</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                id="role-goat"
                type="button"
                onClick={() => onSelectAIRole('goat')}
                className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${
                  aiUserRole === 'goat'
                    ? 'bg-slate-200 text-stone-950 border-white ring-2 ring-amber-400/50 shadow-md font-bold'
                    : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:bg-stone-850'
                }`}
              >
                <div className="text-xl p-1 bg-stone-800/40 rounded-xl">🐐</div>
                <div className="text-left">
                  <div className="text-xs font-black">Goat</div>
                  <div className={`text-[9px] ${aiUserRole === 'goat' ? 'text-stone-700' : 'text-stone-500'}`}>
                    20 Goats · Trap Tigers
                  </div>
                </div>
              </button>

              <button
                id="role-tiger"
                type="button"
                onClick={() => onSelectAIRole('tiger')}
                className={`flex items-center gap-2.5 p-2.5 rounded-2xl border transition-all ${
                  aiUserRole === 'tiger'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 border-amber-400 ring-2 ring-amber-400/50 shadow-md font-bold'
                    : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:bg-stone-850'
                }`}
              >
                <div className="text-xl p-1 bg-stone-800/40 rounded-xl">🐅</div>
                <div className="text-left">
                  <div className="text-xs font-black">Tiger</div>
                  <div className={`text-[9px] ${aiUserRole === 'tiger' ? 'text-stone-900' : 'text-stone-500'}`}>
                    4 Tigers · Hunt 5 Goats
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Section 3: AI Difficulty */}
        {mode === 'ai' && (
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>AI Difficulty</span>
              </span>
              <span className="text-[10px] text-stone-500">Minimax Engine</span>
            </label>

            <div className="grid grid-cols-4 gap-1.5">
              {(['easy', 'medium', 'hard', 'adaptive'] as AIDifficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSelectDifficulty(d)}
                  className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition text-center capitalize ${
                    difficulty === d
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-400 shadow'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                  }`}
                >
                  {d === 'adaptive' ? '⚡ Auto' : d === 'hard' ? 'Master' : d}
                </button>
              ))}
            </div>

            {difficulty === 'adaptive' && (
              <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs space-y-1 animate-fade-in shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-300 text-[10px] uppercase flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-purple-400" />
                    Adaptive Tuning
                  </span>
                  <span className="text-[10px] text-purple-200 bg-purple-500/20 px-1.5 py-0.5 rounded">
                    Tier: {adaptiveDetails.tierLabel}
                  </span>
                </div>
                <p className="text-[10px] text-stone-300">{adaptiveDetails.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Match Timer */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Match Timer</span>
            </span>
            <span className="text-[10px] text-stone-500">Clock format</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onSelectTimer('unlimited')}
              className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                timerMode === 'unlimited'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-400 shadow'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div>♾️ Casual</div>
              <div className="text-[9px] text-stone-500 font-normal">No Clock</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTimer('turn30s')}
              className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                timerMode === 'turn30s'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-400 shadow'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div>⏱️ 30s Turn</div>
              <div className="text-[9px] text-stone-500 font-normal">Fast Action</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTimer('blitz5m')}
              className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                timerMode === 'blitz5m'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-400 shadow'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div>⚡ 5m Blitz</div>
              <div className="text-[9px] text-stone-500 font-normal">Competitive</div>
            </button>
          </div>
        </div>

        {/* Section 5: Board Theme */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Board Theme</span>
            </span>
            <span className="text-[10px] text-stone-500">Visual style</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onSelectTheme('classic')}
              className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                boardTheme === 'classic'
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-1 ring-amber-400 shadow'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Classic</span>
              </div>
              <div className="text-[9px] text-stone-500 font-normal">Nepali Wood</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTheme('slate')}
              className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                boardTheme === 'slate'
                  ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 ring-1 ring-cyan-400 shadow'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span>Slate</span>
              </div>
              <div className="text-[9px] text-stone-500 font-normal">Himalayan Blue</div>
            </button>

            <button
              type="button"
              onClick={() => onSelectTheme('midnight')}
              className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                boardTheme === 'midnight'
                  ? 'bg-purple-600/20 border-purple-500 text-purple-300 ring-1 ring-purple-400 shadow'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span>Midnight</span>
              </div>
              <div className="text-[9px] text-stone-500 font-normal">Obsidian Neon</div>
            </button>
          </div>
        </div>

        {/* Start Game Action Button */}
        <button
          id="setup-start-game-btn"
          type="button"
          onClick={onStartGame}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-600/20 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] ring-2 ring-amber-400/40 mt-1"
        >
          <Play className="w-4 h-4 fill-stone-950" />
          <span>{mode === 'online' ? 'Enter Online Arena' : 'Start Match'}</span>
        </button>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center text-[10px] text-stone-500 pt-1 border-t border-stone-900/80 z-10">
        Baghchal · Nepali Strategic Heritage Board Game
      </footer>
    </div>
  );
};
