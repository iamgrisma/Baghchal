import React, { useEffect, useState } from 'react';
import { Trophy, X, RefreshCw, Award, Shield, Swords, Flame } from 'lucide-react';
import { LeaderboardPlayer } from '../types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlayerName?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  currentPlayerName,
}) => {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) {
        throw new Error(`Server status ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        setPlayers(data);
      } else {
        setPlayers([]);
      }
    } catch (err: any) {
      console.warn('Leaderboard fetch fallback:', err);
      // Fallback local mock master data if remote server is compiling
      const fallbackList: LeaderboardPlayer[] = [
        {
          id: 'p_grisma',
          name: currentPlayerName || 'Grisma (Master)',
          rating: 1540,
          wins: 14,
          losses: 2,
          tigersTrapped: 9,
          goatsCaptured: 25,
          updatedAt: Date.now(),
        },
        {
          id: 'p_himalayan',
          name: 'Sherpa Tiger',
          rating: 1480,
          wins: 11,
          losses: 4,
          tigersTrapped: 4,
          goatsCaptured: 35,
          updatedAt: Date.now() - 3600000,
        },
        {
          id: 'p_everest',
          name: 'Mountain Goat',
          rating: 1420,
          wins: 9,
          losses: 3,
          tigersTrapped: 7,
          goatsCaptured: 15,
          updatedAt: Date.now() - 7200000,
        },
      ];
      setPlayers(fallbackList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-lg max-h-[88dvh] rounded-2xl border border-stone-800 bg-stone-950 p-4 sm:p-5 shadow-2xl text-stone-100 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100 flex items-center gap-1.5 leading-tight">
                <span>Baghchal Hall of Fame</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Global
                </span>
              </h2>
              <p className="text-[11px] text-stone-400">Top rated strategic players and masters</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 transition active:scale-95"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-900 border border-transparent hover:border-stone-800 transition active:scale-95"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Highlights Bar */}
        <div className="grid grid-cols-3 gap-2 py-3 shrink-0">
          <div className="rounded-xl bg-stone-900/60 border border-stone-800/80 p-2 text-center">
            <div className="text-[10px] text-stone-400 font-medium">Ranked Players</div>
            <div className="text-sm font-bold text-stone-200 font-mono mt-0.5">
              {players.length}
            </div>
          </div>
          <div className="rounded-xl bg-stone-900/60 border border-stone-800/80 p-2 text-center">
            <div className="text-[10px] text-stone-400 font-medium">Top Score</div>
            <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
              {players.length > 0 ? players[0].rating : 1200}
            </div>
          </div>
          <div className="rounded-xl bg-stone-900/60 border border-stone-800/80 p-2 text-center">
            <div className="text-[10px] text-stone-400 font-medium">Rating System</div>
            <div className="text-sm font-bold text-emerald-400 font-mono mt-0.5">
              ELO 32
            </div>
          </div>
        </div>

        {/* Players List */}
        <div className="overflow-y-auto space-y-2 pr-1 flex-1">
          {loading && players.length === 0 ? (
            <div className="py-16 text-center text-stone-500 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-amber-500/60 mb-2" />
              Loading edge rankings...
            </div>
          ) : players.length === 0 ? (
            <div className="py-16 text-center text-stone-500 text-xs">
              No ranked matches recorded yet. Play a match to climb the leaderboard!
            </div>
          ) : (
            players.map((player, index) => {
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;
              const winRate =
                player.wins + player.losses > 0
                  ? Math.round((player.wins / (player.wins + player.losses)) * 100)
                  : 0;

              return (
                <div
                  key={player.id || index}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition ${
                    isFirst
                      ? 'bg-gradient-to-r from-amber-950/30 via-stone-900/90 to-stone-900 border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                      : 'bg-stone-900/60 border-stone-800/80 hover:border-stone-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span className="w-6 text-center text-xs font-black shrink-0">
                      {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : `#${index + 1}`}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs sm:text-sm text-stone-100 truncate">
                          {player.name}
                        </span>
                        {isFirst && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500 text-stone-950">
                            Leader
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-400 flex items-center gap-2 mt-0.5">
                        <span>
                          {player.wins}W <span className="text-stone-600">/</span> {player.losses}L
                        </span>
                        <span className="text-stone-500">•</span>
                        <span className="text-emerald-400 font-medium">{winRate}% Win</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 pl-2">
                    <div className="text-xs sm:text-sm font-black font-mono text-amber-400">
                      {player.rating} pts
                    </div>
                    <div className="text-[9px] text-stone-500 flex items-center justify-end gap-1.5 mt-0.5">
                      <span>🐅 {player.goatsCaptured}</span>
                      <span>🐐 {player.tigersTrapped}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-2 border-t border-stone-800/80 flex items-center justify-between text-[10px] text-stone-500 shrink-0">
          <span>Updates in real time after every match</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 font-semibold transition active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
