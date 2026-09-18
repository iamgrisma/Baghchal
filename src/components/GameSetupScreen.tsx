import React from 'react';
import { ArrowLeft, Bot, Globe, Users, Play, Shield, Sparkles, BookOpen, Zap, TrendingUp } from 'lucide-react';
import { AIDifficulty, GameMode, PlayerProfile, PlayerRole } from '../types';
import { getAdaptiveAIDetails } from '../game/ai';

interface GameSetupScreenProps {
  mode: GameMode;
  aiUserRole: PlayerRole;
  difficulty: AIDifficulty;
  profile?: PlayerProfile;
  onSelectMode: (mode: GameMode) => void;
  onSelectAIRole: (role: PlayerRole) => void;
  onSelectDifficulty: (difficulty: AIDifficulty) => void;
  onStartGame: () => void;
  onBackToSplash: () => void;
  onOpenRules: () => void;
}

export const GameSetupScreen: React.FC<GameSetupScreenProps> = ({
  mode,
  aiUserRole,
  difficulty,
  profile,
  onSelectMode,
  onSelectAIRole,
  onSelectDifficulty,
  onStartGame,
  onBackToSplash,
  onOpenRules,
}) => {
  const adaptiveDetails = getAdaptiveAIDetails(profile);
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-stone-950 text-stone-100 px-4 py-5 select-none overflow-y-auto">
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
      <main className="w-full max-w-md flex flex-col gap-5 my-auto py-4 z-10">
        
        {/* Section 1: Top 3 Modes */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Select Game Mode</span>
          </label>

          <div className="grid grid-cols-3 gap-2">
            {/* Mode 1: vs AI */}
            <button
              id="mode-vs-ai"
              type="button"
              onClick={() => onSelectMode('ai')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1.5 ${
                mode === 'ai'
                  ? 'bg-amber-600/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/40 shadow-lg'
                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className={`p-2 rounded-xl ${mode === 'ai' ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'}`}>
                <Bot className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight">vs AI</span>
              <span className="text-[9px] text-stone-500">Computer</span>
            </button>

            {/* Mode 2: Online */}
            <button
              id="mode-online"
              type="button"
              onClick={() => onSelectMode('online')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1.5 ${
                mode === 'online'
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300 ring-2 ring-sky-500/40 shadow-lg'
                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className={`p-2 rounded-xl ${mode === 'online' ? 'bg-sky-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'}`}>
                <Globe className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight">Online</span>
              <span className="text-[9px] text-stone-500">Multiplayer</span>
            </button>

            {/* Mode 3: Friend (Offline) */}
            <button
              id="mode-local"
              type="button"
              onClick={() => onSelectMode('local')}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center gap-1.5 ${
                mode === 'local'
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/40 shadow-lg'
                  : 'bg-stone-900/90 border-stone-800 text-stone-400 hover:bg-stone-850 hover:text-stone-200'
              }`}
            >
              <div className={`p-2 rounded-xl ${mode === 'local' ? 'bg-emerald-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300'}`}>
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold leading-tight">Friend (Offline)</span>
              <span className="text-[9px] text-stone-500">Same Device</span>
            </button>
          </div>
        </div>

        {/* Section 2: Play as (FOR FRIENDS MODE PLAY AS IS NOT TO BE SET) */}
        {mode !== 'local' && (
          <div className="space-y-2 animate-fade-in">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Play as</span>
              </span>
              <span className="text-[10px] text-stone-500 font-normal lowercase">Choose your faction</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* Option: Goat */}
              <button
                id="role-goat"
                type="button"
                onClick={() => onSelectAIRole('goat')}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  aiUserRole === 'goat'
                    ? 'bg-slate-200 text-stone-950 border-white ring-2 ring-amber-400/50 shadow-lg font-bold'
                    : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:bg-stone-850'
                }`}
              >
                <div className="text-2xl p-1 bg-stone-800/40 rounded-xl">🐐</div>
                <div className="text-left">
                  <div className="text-xs font-black">Goat (बाख्रा)</div>
                  <div className={`text-[10px] ${aiUserRole === 'goat' ? 'text-stone-700' : 'text-stone-500'}`}>
                    20 Goats · Trap 4 Tigers
                  </div>
                </div>
              </button>

              {/* Option: Tiger */}
              <button
                id="role-tiger"
                type="button"
                onClick={() => onSelectAIRole('tiger')}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  aiUserRole === 'tiger'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-stone-950 border-amber-400 ring-2 ring-amber-400/50 shadow-lg font-bold'
                    : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:bg-stone-850'
                }`}
              >
                <div className="text-2xl p-1 bg-stone-800/40 rounded-xl">🐅</div>
                <div className="text-left">
                  <div className="text-xs font-black">Tiger (बाघ)</div>
                  <div className={`text-[10px] ${aiUserRole === 'tiger' ? 'text-stone-900' : 'text-stone-500'}`}>
                    4 Tigers · Hunt 5 Goats
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Section 3: Level (IN CASE OF AI MODE ONLY) */}
        {mode === 'ai' && (
          <div className="space-y-2 animate-fade-in">
            <label className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Level (AI Difficulty)</span>
              </span>
              <span className="text-[10px] text-stone-500 font-normal">Minimax Intelligence</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                id="difficulty-easy"
                type="button"
                onClick={() => onSelectDifficulty('easy')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                  difficulty === 'easy'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-1 ring-emerald-400 shadow'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                }`}
              >
                🟢 Easy
              </button>

              <button
                id="difficulty-medium"
                type="button"
                onClick={() => onSelectDifficulty('medium')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                  difficulty === 'medium'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-400 shadow'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                }`}
              >
                🟡 Medium
              </button>

              <button
                id="difficulty-hard"
                type="button"
                onClick={() => onSelectDifficulty('hard')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center ${
                  difficulty === 'hard'
                    ? 'bg-red-500/20 border-red-500 text-red-300 ring-1 ring-red-400 shadow'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                }`}
              >
                🔴 Hard
              </button>

              <button
                id="difficulty-adaptive"
                type="button"
                onClick={() => onSelectDifficulty('adaptive')}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition text-center relative overflow-hidden ${
                  difficulty === 'adaptive'
                    ? 'bg-purple-600/25 border-purple-400 text-purple-200 ring-2 ring-purple-400/50 shadow-lg'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:bg-stone-800 hover:text-purple-300'
                }`}
              >
                <div className="flex items-center justify-center gap-1">
                  <Zap className={`w-3.5 h-3.5 ${difficulty === 'adaptive' ? 'text-purple-400 animate-pulse' : 'text-stone-400'}`} />
                  <span>Adaptive</span>
                </div>
              </button>
            </div>

            {/* Dynamic Adaptive Insights Banner */}
            {difficulty === 'adaptive' && (
              <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-xs space-y-2 animate-fade-in shadow-inner">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-purple-300 text-[11px] uppercase tracking-wider">
                    <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dynamic Auto-Tuning</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-200 border border-purple-500/40">
                    Active: {adaptiveDetails.tierLabel}
                  </span>
                </div>

                <p className="text-[11px] text-stone-300 leading-snug">
                  {adaptiveDetails.description}
                </p>

                <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1 border-t border-purple-800/40 font-mono">
                  <span>Player Win Rate: <strong className="text-purple-300 font-sans">{adaptiveDetails.winRate}%</strong> ({adaptiveDetails.playerWins}W / {adaptiveDetails.totalAiGames} AI games)</span>
                  {adaptiveDetails.recentForm.length > 0 && (
                    <div className="flex items-center gap-1 font-sans">
                      <span className="text-[9px] text-stone-400">Recent:</span>
                      <div className="flex gap-0.5">
                        {adaptiveDetails.recentForm.map((res, idx) => (
                          <span
                            key={`form-${idx}`}
                            className={`w-3.5 h-3.5 rounded text-[9px] flex items-center justify-center font-bold ${
                              res === 'W'
                                ? 'bg-emerald-500 text-stone-950'
                                : 'bg-rose-600 text-white'
                            }`}
                          >
                            {res}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Informative summary card */}
        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-3.5 text-xs text-stone-400 leading-relaxed">
          {mode === 'ai' && (
            <p>
              Match setup: You will play as{' '}
              <strong className="text-amber-400 capitalize">{aiUserRole}</strong> on{' '}
              <strong className="text-amber-400 capitalize">
                {difficulty === 'adaptive' ? `Adaptive AI (${adaptiveDetails.tierLabel})` : `${difficulty} level`}
              </strong>{' '}
              against smart computer opponent.
            </p>
          )}
          {mode === 'online' && (
            <p>
              Match setup: Connect with friends or matchmaking peers worldwide via real-time WebRTC peer-to-peer rooms.
            </p>
          )}
          {mode === 'local' && (
            <p>
              Match setup: Pass-and-play on the same device. Both players take turns (Goats place first, then Tigers move).
            </p>
          )}
        </div>

        {/* Start Game Action Button */}
        <button
          id="setup-start-game-btn"
          type="button"
          onClick={onStartGame}
          className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-amber-600/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ring-2 ring-amber-400/40 mt-2"
        >
          <Play className="w-4 h-4 fill-stone-950" />
          <span>{mode === 'online' ? 'Enter Online Arena' : 'Start Game'}</span>
        </button>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center text-[10px] text-stone-500 pt-2 border-t border-stone-900/80 z-10">
        Baghchal (बाघचाल) · Authentic Himalayan Board Game Strategy
      </footer>
    </div>
  );
};
