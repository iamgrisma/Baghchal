import React, { useState } from 'react';
import { Globe, Users, Copy, Check, X, RefreshCw, Radio, Sparkles, Share2 } from 'lucide-react';
import { OnlineRoomInfo, PlayerRole } from '../types';
import { shareViaTelegram } from '../utils/telegram';

interface OnlineLobbyModalProps {
  isOpen: boolean;
  playerName: string;
  isSearching: boolean;
  matchStatusText: string;
  roomInfo: OnlineRoomInfo | null;
  onClose: () => void;
  onStartAutoMatch: (role: 'any' | 'tiger' | 'goat') => void;
  onCancelAutoMatch: () => void;
  onJoinCustomRoom: (roomId: string, asHost: boolean) => void;
}

export const OnlineLobbyModal: React.FC<OnlineLobbyModalProps> = ({
  isOpen,
  playerName,
  isSearching,
  matchStatusText,
  roomInfo,
  onClose,
  onStartAutoMatch,
  onCancelAutoMatch,
  onJoinCustomRoom,
}) => {
  const [preferredRole, setPreferredRole] = useState<'any' | 'tiger' | 'goat'>('any');
  const [customRoomInput, setCustomRoomInput] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCreateRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    onJoinCustomRoom(`bc_${code}`, true);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRoomInput.trim()) return;
    const clean = customRoomInput.trim().toUpperCase();
    const roomId = clean.startsWith('BC_') ? clean.toLowerCase() : `bc_${clean.toLowerCase()}`;
    onJoinCustomRoom(roomId, false);
  };

  const handleCopyLink = () => {
    if (roomInfo) {
      const code = roomInfo.roomId.replace('bc_', '').toUpperCase();
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleTelegramShare = () => {
    if (roomInfo) {
      const code = roomInfo.roomId.replace('bc_', '').toUpperCase();
      const text = `🐅 Play Baghchal (बाघचाल) with me on Telegram! Join room code: ${code}`;
      const url = `${window.location.origin}?room=${roomInfo.roomId}`;
      shareViaTelegram(text, url);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-2xl text-stone-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-stone-100">Online Multiplayer</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-4 space-y-4">
          
          {/* Active Room Connection Status (if in room) */}
          {roomInfo ? (
            <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Connected Match
                </span>
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {roomInfo.usingP2P ? 'Direct WebRTC (P2P)' : 'Live KV Sync'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-stone-950/80 p-2.5 rounded-lg border border-stone-800">
                <div>
                  <div className="text-xs text-stone-400">Opponent</div>
                  <div className="text-sm font-bold text-stone-100">{roomInfo.opponentName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-stone-400">Your Role</div>
                  <div className="text-sm font-bold text-amber-400 capitalize">{roomInfo.myRole}</div>
                </div>
              </div>

              {/* Room Code */}
              <div className="bg-stone-950/60 p-2.5 rounded-lg border border-stone-800/80 space-y-2">
                <div className="text-xs text-stone-400">
                  Room Code: <span className="font-mono font-bold text-stone-200">{roomInfo.roomId.replace('bc_', '').toUpperCase()}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-200 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Code Copied' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={handleTelegramShare}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition shadow"
                    title="Send game invite to Telegram chat or channel"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Telegram Invite</span>
                  </button>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-sm font-bold shadow transition"
              >
                Return to Game
              </button>
            </div>
          ) : isSearching ? (
            /* Matchmaking in Progress */
            <div className="rounded-xl border border-stone-800 bg-stone-950/80 p-6 text-center space-y-4">
              <div className="relative mx-auto w-12 h-12">
                <RefreshCw className="w-12 h-12 text-amber-500 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-100">Searching for Opponent</h3>
                <p className="text-xs text-stone-400 mt-1">{matchStatusText}</p>
              </div>
              <button
                onClick={onCancelAutoMatch}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cancel Search
              </button>
            </div>
          ) : (
            /* Lobby Selection Options */
            <>
              {/* Auto Matchmaking Box */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-stone-100">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Quick Auto-Match</span>
                  </div>
                  <span className="text-[11px] text-stone-400">Low-latency WebRTC</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">Role:</span>
                  <div className="flex rounded-lg bg-stone-900 p-0.5 border border-stone-800 text-xs">
                    {(['any', 'goat', 'tiger'] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setPreferredRole(r)}
                        className={`px-2.5 py-1 rounded capitalize font-medium transition ${
                          preferredRole === r
                            ? 'bg-amber-600 text-stone-950'
                            : 'text-stone-400 hover:text-stone-200'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  id="auto-match-btn"
                  onClick={() => onStartAutoMatch(preferredRole)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-sm shadow transition active:scale-98"
                >
                  <Users className="w-4 h-4" />
                  <span>Find Match Now</span>
                </button>
              </div>

              {/* Private Room Section */}
              <div className="rounded-xl border border-stone-800 bg-stone-950/40 p-4 space-y-3">
                <div className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                  Play with a Friend
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleCreateRoom}
                    className="py-2 px-3 rounded-lg border border-stone-700 bg-stone-900 hover:bg-stone-800 text-xs font-semibold text-stone-200 transition"
                  >
                    Create Private Room
                  </button>

                  <form onSubmit={handleJoinRoom} className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Code (e.g. 7A8B9)"
                      value={customRoomInput}
                      onChange={(e) => setCustomRoomInput(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-stone-800 bg-stone-950 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-600"
                    />
                    <button
                      type="submit"
                      disabled={!customRoomInput.trim()}
                      className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-xs font-semibold text-stone-200 transition"
                    >
                      Join
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}

          <div className="text-[11px] text-stone-500 text-center leading-relaxed">
            Direct peer-to-peer connection with real-time state synchronization. Works on all modern mobile and desktop browsers.
          </div>
        </div>
      </div>
    </div>
  );
};
