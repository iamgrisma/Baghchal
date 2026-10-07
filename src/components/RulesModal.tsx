import React from 'react';
import { X, Shield, Swords, Info, Lock } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-stone-800 bg-stone-900 p-5 shadow-2xl text-stone-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-800 sticky top-0 bg-stone-900 z-10">
          <div>
            <h2 className="text-base font-bold text-amber-400">Rules of Baghchal (बाघचाल)</h2>
            <p className="text-xs text-stone-400">Traditional Strategic Board Game of Nepal</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rules Content */}
        <div className="mt-4 space-y-4 text-xs sm:text-sm text-stone-300 leading-relaxed">
          
          {/* Overview */}
          <div className="rounded-xl bg-stone-950/70 p-3 border border-stone-800 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-stone-100">
              <Info className="w-4 h-4 text-amber-500" />
              <span>The Concept (4 Tigers vs. 20 Goats)</span>
            </div>
            <p className="text-stone-400 text-xs">
              Baghchal is an asymmetric two-player strategy game. One player commands <strong>4 Tigers</strong>, and the other commands a herd of <strong>20 Goats</strong>. Goats always take the first turn!
            </p>
          </div>

          {/* Phase 1: Placement Phase */}
          <div className="space-y-2">
            <h3 className="font-bold text-stone-100 text-sm flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-slate-300" /> Phase 1: Placement
            </h3>
            <p className="text-stone-300">
              Goats place one goat at a time onto any empty intersection point on the 5x5 board. Placed goats cannot be moved until all 20 goats have entered the board.
            </p>
            <p className="text-stone-400 text-xs">
              Tigers are already on the board from turn 1. On Tiger's turn, a tiger can either make a 1-step move to an adjacent empty spot or jump over an adjacent goat to capture it.
            </p>
          </div>

          {/* Phase 2: Movement Phase */}
          <div className="space-y-2">
            <h3 className="font-bold text-stone-100 text-sm flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-amber-500" /> Phase 2: Movement
            </h3>
            <p className="text-stone-300">
              Once all 20 goats have been placed on the board, goats may now move 1 step along any connected grid or diagonal line to an empty adjacent intersection.
            </p>
          </div>

          {/* Tiger Capture Mechanics */}
          <div className="space-y-2 rounded-xl bg-amber-950/20 border border-amber-800/40 p-3">
            <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              <Swords className="w-4 h-4 text-amber-500" /> How Tigers Attack &amp; Capture
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs text-stone-300">
              <li>A Tiger can jump in a straight line over an adjacent Goat if the landing spot immediately behind that goat is <strong>empty</strong>.</li>
              <li>The jumped goat is removed from the board (captured).</li>
              <li>A Tiger cannot jump over another tiger, nor jump over two goats in one leap.</li>
            </ul>
          </div>

          {/* Goat Defense & Strategic Locking */}
          <div className="space-y-2 rounded-xl bg-slate-900/60 border border-slate-800 p-3">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-teal-400" /> Continuous Crossing Locks (Goat Strategy)
            </h3>
            <p className="text-xs text-stone-300">
              To defend against tiger attacks, goats must advance in continuous pairs or lines of two or more. If two goats stand side by side along a line, a tiger cannot jump because the landing spot is occupied!
            </p>
            <p className="text-xs text-stone-400">
              Use continuous crossing locks to gradually cordon off corners and immobilize tigers one by one.
            </p>
          </div>

          {/* Winning Conditions */}
          <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
            <div className="p-2.5 rounded-lg bg-stone-950 border border-amber-900/50">
              <div className="font-bold text-amber-400 mb-1">Tigers Win:</div>
              <div className="text-stone-400">If Tigers capture <strong>5 Goats</strong>.</div>
            </div>
            <div className="p-2.5 rounded-lg bg-stone-950 border border-emerald-900/50">
              <div className="font-bold text-emerald-400 mb-1">Goats Win:</div>
              <div className="text-stone-400">If all <strong>4 Tigers are trapped</strong> with 0 legal moves left.</div>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-stone-950 font-bold text-sm transition"
        >
          Close &amp; Play
        </button>

        <div className="mt-3 text-center">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-stone-400 hover:text-amber-400 underline transition"
          >
            Privacy Policy &amp; Terms
          </a>
        </div>
      </div>
    </div>
  );
};
