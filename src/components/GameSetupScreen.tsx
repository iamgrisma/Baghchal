import React from 'react';
import {
  ArrowLeft,
  Bot,
  Globe,
  Users,
  Play,
  BookOpen,
  Zap,
  TrendingUp,
  Clock,
  Palette,
  Check,
  Shield,
  Flame,
  Award,
} from 'lucide-react';
import { AIDifficulty, BoardTheme, GameMode, PlayerProfile, PlayerRole, TimerMode } from '../types';
import { getAdaptiveAIDetails } from '../game/ai';
import { TigerIcon, GoatIcon } from './GameIcons';

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
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-stone-950 text-stone-100 select-none overflow-y-auto">
      {/* Android Material Top App Bar */}
      <header className="w-full max-w-md h-16 px-4 flex items-center justify-between bg-stone-900/90 border-b border-stone-800/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            id="setup-back-btn"
            onClick={onBackToSplash}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-700 transition"
            aria-label="Navigate Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-stone-100 leading-tight">
              Match Setup
            </h1>
            <p className="text-xs text-stone-400">Configure game rules</p>
          </div>
        </div>

        <button
          onClick={onOpenRules}
          className="w-10 h-10 rounded-full flex items-center justify-center text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-700 transition"
          title="Game Rules"
        >
          <BookOpen className="w-5 h-5 text-amber-400" />
        </button>
      </header>

      {/* Main Material 3 Content Container */}
      <main className="w-full max-w-md flex flex-col gap-4 p-4 my-auto z-10">
        {/* Section 1: Mode Segmented Button */}
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-0.5">
            Game Mode
          </div>

          <div className="grid grid-cols-3 rounded-2xl bg-stone-900 border border-stone-800 p-1 gap-1">
            <button
              id="mode-vs-ai"
              type="button"
              onClick={() => onSelectMode('ai')}
              className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-semibold transition ${
                mode === 'ai'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span>VS AI</span>
            </button>

            <button
              id="mode-online"
              type="button"
              onClick={() => onSelectMode('online')}
              className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-semibold transition ${
                mode === 'online'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <span>Online</span>
            </button>

            <button
              id="mode-local"
              type="button"
              onClick={() => onSelectMode('local')}
              className={`flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl text-xs font-semibold transition ${
                mode === 'local'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                  : 'text-stone-300 hover:text-white hover:bg-stone-850'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Pass & Play</span>
            </button>
          </div>
        </section>

        {/* Section 2: Faction Selection Cards */}
        {mode !== 'local' && (
          <section className="space-y-2 animate-fade-in">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-0.5">
              Player Faction
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Goat Selection Card */}
              <button
                id="role-goat"
                type="button"
                onClick={() => onSelectAIRole('goat')}
                className={`flex flex-col p-3 rounded-2xl border text-left transition relative ${
                  aiUserRole === 'goat'
                    ? 'bg-stone-900 border-amber-400 ring-1 ring-amber-400/50'
                    : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      aiUserRole === 'goat'
                        ? 'bg-slate-200 text-stone-950'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    <GoatIcon className="w-5 h-5" />
                  </div>
                  {aiUserRole === 'goat' && (
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="font-bold text-xs text-stone-100">Goat Faction</div>
                <div className="text-[11px] text-stone-400 mt-0.5">20 Goats · Trap 4 Tigers</div>
              </button>

              {/* Tiger Selection Card */}
              <button
                id="role-tiger"
                type="button"
                onClick={() => onSelectAIRole('tiger')}
                className={`flex flex-col p-3 rounded-2xl border text-left transition relative ${
                  aiUserRole === 'tiger'
                    ? 'bg-stone-900 border-amber-400 ring-1 ring-amber-400/50'
                    : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      aiUserRole === 'tiger'
                        ? 'bg-amber-500 text-stone-950'
                        : 'bg-stone-800 text-stone-300'
                    }`}
                  >
                    <TigerIcon className="w-5 h-5" />
                  </div>
                  {aiUserRole === 'tiger' && (
                    <div className="w-5 h-5 rounded-full bg-amber-400 text-stone-950 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </div>
                <div className="font-bold text-xs text-stone-100">Tiger Faction</div>
                <div className="text-[11px] text-stone-400 mt-0.5">4 Tigers · Hunt 5 Goats</div>
              </button>
            </div>
          </section>
        )}

        {/* Section 3: AI Difficulty Segmented Button */}
        {mode === 'ai' && (
          <section className="space-y-2 animate-fade-in">
            <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-0.5">
              AI Difficulty
            </div>

            <div className="grid grid-cols-4 rounded-2xl bg-stone-900 border border-stone-800 p-1 gap-1 text-center">
              {[
                { id: 'easy', label: 'Easy', icon: Shield },
                { id: 'medium', label: 'Medium', icon: Award },
                { id: 'hard', label: 'Hard', icon: Flame },
                { id: 'adaptive', label: 'Adaptive', icon: Zap },
              ].map(({ id, label, icon: Icon }) => {
                const isSelected = difficulty === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectDifficulty(id as AIDifficulty)}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs font-semibold transition gap-0.5 ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                        : 'text-stone-400 hover:text-white hover:bg-stone-850'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {difficulty === 'adaptive' && (
              <div className="p-3 rounded-2xl bg-stone-900/90 border border-purple-500/30 text-xs space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-300 text-[11px] uppercase flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    Performance Tracking
                  </span>
                  <span className="text-[10px] font-bold text-purple-200 bg-purple-500/20 px-2 py-0.5 rounded-lg border border-purple-500/30">
                    Tier: {adaptiveDetails.tierLabel}
                  </span>
                </div>
                <p className="text-[11px] text-stone-300 leading-snug">
                  {adaptiveDetails.description}
                </p>
              </div>
            )}
          </section>
        )}

        {/* Section 4: Match Timer Segmented Group */}
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-0.5">
            Turn Clock
          </div>

          <div className="grid grid-cols-3 rounded-2xl bg-stone-900 border border-stone-800 p-1 gap-1">
            {[
              { id: 'unlimited', label: 'Casual', sub: 'No Timer' },
              { id: 'turn30s', label: '30s Turn', sub: 'Per Action' },
              { id: 'blitz5m', label: '5m Blitz', sub: 'Total Clock' },
            ].map(({ id, label, sub }) => {
              const isSelected = timerMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTimer(id as TimerMode)}
                  className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl text-xs transition ${
                    isSelected
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                      : 'text-stone-300 hover:text-white hover:bg-stone-850'
                  }`}
                >
                  <span className="font-semibold">{label}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-stone-900' : 'text-stone-500'}`}>
                    {sub}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 5: Board Theme Cards */}
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400 px-0.5">
            Board Theme
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'classic', label: 'Woodland', color: 'bg-amber-500', border: 'border-amber-500' },
              { id: 'slate', label: 'Highland', color: 'bg-cyan-400', border: 'border-cyan-400' },
              { id: 'midnight', label: 'Obsidian', color: 'bg-purple-400', border: 'border-purple-400' },
            ].map(({ id, label, color, border }) => {
              const isSelected = boardTheme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectTheme(id as BoardTheme)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs transition ${
                    isSelected
                      ? `bg-stone-900 ${border} text-stone-100 ring-1 ${border}/50`
                      : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:border-stone-700'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full ${color} mb-1 shadow-sm`} />
                  <span className="font-semibold text-stone-200">{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Start Game Action Button (Android M3 Filled Button) */}
        <div className="pt-2">
          <button
            id="setup-start-game-btn"
            type="button"
            onClick={onStartGame}
            className="w-full h-13 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-bold text-sm tracking-wide shadow-md transition flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-stone-950" />
            <span>{mode === 'online' ? 'Enter Room' : 'Start Match'}</span>
          </button>
        </div>
      </main>

      {/* Android Subtle Bottom Safe Area */}
      <footer className="w-full max-w-md text-center text-[11px] text-stone-500 py-2 border-t border-stone-900">
        Baghchal Board System
      </footer>
    </div>
  );
};
