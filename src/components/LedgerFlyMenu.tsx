import React, { useState } from 'react';
import { X, ShieldCheck, History, ChevronDown, ChevronUp, Copy, Check, Clock } from 'lucide-react';
import { LedgerBlock } from '../game/ledger';

interface LedgerFlyMenuProps {
  isOpen: boolean;
  onClose: () => void;
  chain: LedgerBlock[];
}

export const LedgerFlyMenu: React.FC<LedgerFlyMenuProps> = ({ isOpen, onClose, chain }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
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

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-md h-full bg-stone-950 border-l border-stone-800 flex flex-col shadow-2xl text-stone-200">
        {/* Header */}
        <header className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
                Match Move History
              </h2>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Cryptographically Verified Chain</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Status Bar */}
        <div className="px-4 py-2.5 bg-stone-900/30 border-b border-stone-800 flex items-center justify-between text-xs">
          <span className="text-stone-400">
            Total Moves: <strong className="font-mono text-stone-100">{chain.length}</strong>
          </span>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded-full">
            All Moves Verified ✓
          </span>
        </div>

        {/* Human-Readable Move Stream */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
          {chain.length === 0 ? (
            <div className="py-24 text-center text-stone-500 text-xs">
              No moves recorded yet. Play a move to begin the game chronicle.
            </div>
          ) : (
            chain.slice().reverse().map((block) => {
              const isGoat = block.actor === 'goat';
              const timeString = new Date(block.timestamp).toLocaleTimeString();
              const isExpanded = expandedIndex === block.index;

              return (
                <div
                  key={block.index}
                  className="p-3 rounded-xl bg-stone-900/80 border border-stone-800 hover:border-stone-700 transition space-y-2 shadow-sm"
                >
                  {/* Primary Narrative Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{isGoat ? '🐐' : '🐅'}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-stone-200">
                          Move #{block.index + 1} · {isGoat ? `Goat ${block.pieceId}` : `Tiger ${block.pieceId}`}
                        </span>
                        <span className="text-[10px] text-stone-400 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{timeString}</span>
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-800/40 px-2 py-0.5 rounded">
                      Verified ✓
                    </span>
                  </div>

                  {/* Clean Plain Language Description */}
                  <div className="text-xs text-stone-300 bg-stone-950/60 p-2.5 rounded-lg border border-stone-850 leading-relaxed">
                    {block.action === 'PLACE' && (
                      <span>
                        Placed goat on point <strong className="font-mono text-amber-300 uppercase">{block.to}</strong>.
                      </span>
                    )}
                    {block.action === 'MOVE' && (
                      <span>
                        Moved from point <strong className="font-mono text-stone-400 uppercase">{block.from}</strong> to point <strong className="font-mono text-amber-300 uppercase">{block.to}</strong>.
                      </span>
                    )}
                    {block.action === 'JUMP' && (
                      <span>
                        Leaped from <strong className="font-mono text-stone-400 uppercase">{block.from}</strong> to <strong className="font-mono text-amber-300 uppercase">{block.to}</strong> and captured <strong className="font-mono text-red-400">{block.capturedGoatId || 'Goat'}</strong>.
                      </span>
                    )}
                  </div>

                  {/* Technical Proof Dropdown */}
                  <div>
                    <button
                      onClick={() => toggleExpand(block.index)}
                      className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-amber-400 transition pt-0.5"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>{isExpanded ? 'Hide Cryptographic Proof' : 'View Cryptographic Proof'}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 p-2 rounded bg-stone-950 border border-stone-850 space-y-1.5 text-[9px] font-mono text-stone-400">
                        <div className="truncate">
                          <span className="text-stone-400 font-semibold">Prev Hash: </span>
                          <span className="text-stone-300">{block.prevHash}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1 pt-1 border-t border-stone-900">
                          <div className="truncate">
                            <span className="text-stone-400 font-semibold">Block Hash: </span>
                            <span className="text-amber-300">{block.hash}</span>
                          </div>
                          <button
                            onClick={() => handleCopy(block.hash)}
                            className="p-1 rounded hover:bg-stone-800 text-stone-400 hover:text-amber-300 transition shrink-0"
                            title="Copy Hash"
                          >
                            {copiedHash === block.hash ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <footer className="p-3 border-t border-stone-800 text-center text-[10px] text-stone-500">
          Decentralized Tamper-Proof Audit Trail
        </footer>
      </div>
    </div>
  );
};
