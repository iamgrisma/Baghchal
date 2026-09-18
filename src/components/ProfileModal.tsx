import React, { useState } from 'react';
import { X, User, Trophy, Flame, Shield, Swords, Trash2, Edit2, Check } from 'lucide-react';
import { PlayerProfile } from '../types';

interface ProfileModalProps {
  isOpen: boolean;
  profile: PlayerProfile;
  onClose: () => void;
  onUpdateName: (name: string) => void;
  onResetStats: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  profile,
  onClose,
  onUpdateName,
  onResetStats,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(profile.name);

  if (!isOpen) return null;

  const totalWins = profile.winsGoat + profile.winsTiger;
  const winRate = profile.gamesPlayed > 0 ? Math.round((totalWins / profile.gamesPlayed) * 100) : 0;

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      onUpdateName(newName.trim());
      setIsEditingName(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-2xl text-stone-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-stone-100">Player Profile</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          
          {/* Player Name Card */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-950 border border-stone-800">
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-2 w-full">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={24}
                  className="flex-1 px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-700 text-sm text-stone-100 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950"
                >
                  <Check className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <>
                <div>
                  <div className="text-xs text-stone-400">Player Name</div>
                  <div className="text-base font-bold text-stone-100">{profile.name}</div>
                </div>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition"
                  title="Edit Name"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {/* Core Stats Bento Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className="text-xs text-stone-400">Matches</div>
              <div className="text-lg font-bold text-stone-100 font-mono mt-0.5">
                {profile.gamesPlayed}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className="text-xs text-stone-400">Win Rate</div>
              <div className="text-lg font-bold text-amber-400 font-mono mt-0.5">
                {winRate}%
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800/80">
              <div className="text-xs text-stone-400 flex items-center justify-center gap-1">
                <Flame className="w-3 h-3 text-orange-500" /> Streak
              </div>
              <div className="text-lg font-bold text-orange-400 font-mono mt-0.5">
                {profile.currentStreak}
              </div>
            </div>
          </div>

          {/* Role Win Breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-slate-300" />
                <span className="text-xs font-medium text-stone-300">As Goat</span>
              </div>
              <span className="text-sm font-bold font-mono text-emerald-400">{profile.winsGoat} Wins</span>
            </div>

            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Swords className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-stone-300">As Tiger</span>
              </div>
              <span className="text-sm font-bold font-mono text-amber-400">{profile.winsTiger} Wins</span>
            </div>
          </div>

          {/* Recent Match History */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-2">
              Recent Matches
            </div>

            {profile.history.length === 0 ? (
              <div className="text-xs text-stone-500 text-center py-4 bg-stone-950/40 rounded-xl border border-stone-800">
                No recorded matches yet. Play a game to view stats!
              </div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {profile.history.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-stone-950/60 border border-stone-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                          m.result === 'won'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
                        }`}
                      >
                        {m.result}
                      </span>
                      <span className="text-stone-300">
                        {m.opponent} ({m.userRole})
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400 font-mono">
                      {m.goatsCaptured} eaten · {m.date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reset Stats */}
          {profile.gamesPlayed > 0 && (
            <div className="pt-2 border-t border-stone-800 flex justify-end">
              <button
                onClick={onResetStats}
                className="flex items-center gap-1 text-xs text-red-400/80 hover:text-red-300 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Reset History</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
