import React from 'react';
import { AIDifficulty, GameMode, PlayerRole } from '../types';
import { RotateCcw, Volume2, VolumeX, BookOpen, User, Users, Bot, Globe } from 'lucide-react';

interface GameControlsProps {
  mode: GameMode;
  difficulty: AIDifficulty;
  aiUserRole: PlayerRole;
  isMuted: boolean;
  canUndo: boolean;
  onSelectMode: (mode: GameMode) => void;
  onSelectDifficulty: (diff: AIDifficulty) => void;
  onSelectAIRole: (role: PlayerRole) => void;
  onUndo: () => void;
  onRestart: () => void;
  onToggleSound: () => void;
  onOpenRules: () => void;
  onOpenProfile: () => void;
  onOpenOnlineLobby: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  mode,
  difficulty,
  aiUserRole,
  isMuted,
  canUndo,
  onSelectMode,
  onSelectDifficulty,
  onSelectAIRole,
  onUndo,
  onRestart,
  onToggleSound,
  onOpenRules,
  onOpenProfile,
  onOpenOnlineLobby,
}) => {
  return (
    <div id="game-controls" className="w-full max-w-xl mx-auto px-2 space-y-2 mt-1">
      {/* Primary Mode Tabs */}
      <div className="flex items-center justify-between gap-1.5 rounded-xl bg-stone-900/90 p-1 border border-stone-800 shadow-inner">
        <button
          id="mode-ai-btn"
          onClick={() => onSelectMode('ai')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition ${
            mode === 'ai'
              ? 'bg-amber-600 text-stone-950 shadow'
              : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Vs AI</span>
        </button>

        <button
          id="mode-local-btn"
          onClick={() => onSelectMode('local')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition ${
            mode === 'local'
              ? 'bg-amber-600 text-stone-950 shadow'
              : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Pass &amp; Play</span>
        </button>

        <button
          id="mode-online-btn"
          onClick={() => {
            onSelectMode('online');
            onOpenOnlineLobby();
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition ${
            mode === 'online'
              ? 'bg-amber-600 text-stone-950 shadow'
              : 'text-stone-300 hover:text-white hover:bg-stone-800/60'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Online P2P</span>
        </button>
      </div>

      {/* AI Sub-options bar (Difficulty & Side selector) */}
      {mode === 'ai' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-900/70 p-2 border border-stone-800 text-xs">
          {/* Difficulty */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-medium">Difficulty:</span>
            <div className="flex rounded-lg bg-stone-950 p-0.5 border border-stone-800">
              {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => onSelectDifficulty(d)}
                  className={`px-2 py-0.5 rounded capitalize font-medium transition ${
                    difficulty === d
                      ? 'bg-amber-600 text-stone-950'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {d === 'hard' ? 'Master' : d}
                </button>
              ))}
            </div>
          </div>

          {/* AI Side Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-medium">Play as:</span>
            <div className="flex rounded-lg bg-stone-950 p-0.5 border border-stone-800">
              <button
                onClick={() => onSelectAIRole('goat')}
                className={`px-2 py-0.5 rounded font-medium transition ${
                  aiUserRole === 'goat'
                    ? 'bg-slate-200 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Goats (20)
              </button>
              <button
                onClick={() => onSelectAIRole('tiger')}
                className={`px-2 py-0.5 rounded font-medium transition ${
                  aiUserRole === 'tiger'
                    ? 'bg-amber-600 text-stone-950'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Tigers (4)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Toolbar: Undo, Restart, Sound, Rules, Profile */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1.5">
          {/* Undo button (only in AI and local modes) */}
          {mode !== 'online' && (
            <button
              id="undo-btn"
              onClick={onUndo}
              disabled={!canUndo}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                canUndo
                  ? 'border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800 active:scale-95'
                  : 'border-stone-800 bg-stone-950 text-stone-600 cursor-not-allowed'
              }`}
              title="Undo last move"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}

          {/* New Game / Restart */}
          <button
            id="restart-btn"
            onClick={onRestart}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-700 bg-stone-900 text-stone-200 hover:bg-stone-800 text-xs font-semibold transition active:scale-95"
            title="Reset Board"
          >
            <span>New Game</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sound Toggle */}
          <button
            id="sound-toggle-btn"
            onClick={onToggleSound}
            className="p-2 rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:text-white hover:bg-stone-800 transition"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-stone-500" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>

          {/* Rules Modal */}
          <button
            id="rules-btn"
            onClick={onOpenRules}
            className="p-2 rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:text-white hover:bg-stone-800 transition"
            title="How to play Baghchal"
          >
            <BookOpen className="w-4 h-4" />
          </button>

          {/* Player Profile & Stats */}
          <button
            id="profile-btn"
            onClick={onOpenProfile}
            className="p-2 rounded-lg border border-stone-800 bg-stone-900 text-stone-300 hover:text-white hover:bg-stone-800 transition"
            title="Player Statistics & Profile"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
