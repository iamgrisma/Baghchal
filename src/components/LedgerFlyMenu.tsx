import React, { useState } from 'react';
import { X, ShieldCheck, Link2, Copy, Check, Clock } from 'lucide-react';
import { LedgerBlock } from '../game/ledger';

interface LedgerFlyMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chain: LedgerBlock[];
}

export const LedgerFlyMenu: React.FC<LedgerFlyMenuProps> = ({ isOpen, onClose, chain }) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (hash: string) => {
    try {
      navigator.clipboard.writeText(hash).then(() => {
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(null), 2000);
      }).catch(() => {});
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md h-full bg-stone-950 border-l border-stone-800 flex flex-col shadow-2xl text-stone-200">
        {/* Header */}
        <header className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
                Game Blockchain Ledger
              </h2>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Append-Only Cryptographic Chain</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Chain Stats Bar */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-stone-900/30 border-b border-stone-800 text-center">
          <div className="p-2 rounded-xl bg-stone-900/70 border border-stone-800">
            <div className="text-[10px] text-stone-400">Total Blocks</div>
            <div className="text-sm font-bold font-mono text-stone-100 mt-0.5">{chain.length}</div>
          </div>
          <div className="p-2 rounded-xl bg-stone-900/70 border border-stone-800">
            <div className="text-[10px] text-stone-400">Chain Status</div>
            <div className="text-xs font-bold text-emerald-400 mt-1">Verified</div>
          </div>
          <div className="p-2 rounded-xl bg-stone-900/70 border border-stone-800">
            <div className="text-[10px] text-stone-400">Hash Algo</div>
            <div className="text-xs font-bold text-amber-400 font-mono mt-1">SHA-256</div>
          </div>
        </div>

        {/* Blocks Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {chain.length === 0 ? (
            <div className="py-20 text-center text-stone-500 text-xs">
              No blocks minted yet. Make a move to start the ledger chain.
            </div>
          ) : (
            chain.slice().reverse().map((block) => {
              const isGoat = block.actor === 'goat';
              const timeString = new Date(block.timestamp).toLocaleTimeString();

              return (
                <div
                  key={block.index}
                  className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 hover:border-amber-500/40 transition space-y-2"
                >
                  {/* Top Block Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black text-amber-400">
                        Block #{block.index}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isGoat
                            ? 'bg-slate-200/10 text-slate-200 border border-slate-700'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {isGoat ? `Goat ${block.pieceId}` : `Tiger ${block.pieceId}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-stone-500 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{timeString}</span>
                    </div>
                  </div>

                  {/* Move Description */}
                  <div className="text-xs text-stone-300 font-medium bg-stone-950/70 p-2 rounded-lg border border-stone-850">
                    {block.action === 'PLACE' && (
                      <span>Placed on coordinate <strong className="text-amber-300 font-mono">{block.to}</strong></span>
                    )}
                    {block.action === 'MOVE' && (
                      <span>Moved from <strong className="text-stone-400 font-mono">{block.from}</strong> to <strong className="text-amber-300 font-mono">{block.to}</strong></span>
                    )}
                    {block.action === 'JUMP' && (
                      <span>
                        Jumped from <strong className="text-stone-400 font-mono">{block.from}</strong> to <strong className="text-amber-300 font-mono">{block.to}</strong>
                        {block.capturedGoatId && (
                          <span className="text-red-400 font-bold ml-1">• Captured {block.capturedGoatId}</span>
                        )}
                      </span>
                    )}
                  </div>

                  {/* Hash Signatures */}
                  <div className="space-y-1 pt-1 text-[9px] font-mono text-stone-500">
                    <div className="flex items-center justify-between">
                      <span className="truncate">Prev: {block.prevHash.substring(0, 16)}...</span>
                    </div>
                    <div className="flex items-center justify-between bg-stone-950 p-1.5 rounded border border-stone-850">
                      <span className="text-stone-400 truncate">
                        Hash: {block.hash.substring(0, 24)}...
                      </span>
                      <button
                        onClick={() => handleCopy(block.hash)}
                        className="text-stone-400 hover:text-amber-300 transition shrink-0 ml-1"
                        title="Copy SHA-256 Hash"
                      >
                        {copiedHash === block.hash ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="p-3 border-t border-stone-800 text-center text-[10px] text-stone-500">
          Decentralized State Machine • 0 Cloud Server Cost
        </footer>
      </div>
    </div>
  );
};
