import React from 'react';
import { Play, BookOpen, Trophy } from 'lucide-react';
import { TigerIcon, GoatIcon } from './GameIcons';

interface SplashScreenProps {
  onStartClick: () => void;
  onOpenRules: () => void;
  onOpenProfile: () => void;
  isTelegram: boolean;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onStartClick,
  onOpenRules,
  onOpenProfile,
  isTelegram,
}) => {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-stone-950 text-stone-100 overflow-hidden select-none">
      {/* Top App Bar Header */}
      <header className="w-full max-w-md h-16 px-4 flex items-center justify-between sticky top-0 z-10 border-b border-stone-900 bg-stone-950/80 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-black text-xs">
            B
          </div>
          <span className="font-bold text-sm tracking-wide text-stone-200">BAGHCHAL</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 hover:bg-stone-900 active:bg-stone-850 transition"
            title="Records"
          >
            <Trophy className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenRules}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 hover:bg-stone-900 active:bg-stone-850 transition"
            title="Rules"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Material Hero Surface */}
      <main className="w-full max-w-md flex flex-col items-center text-center my-auto px-6 py-6 z-10">
        {/* Crest Elevation Card */}
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-3xl bg-stone-900 border border-stone-800 shadow-xl flex items-center justify-center relative overflow-hidden">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <TigerIcon className="w-7 h-7" />
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-200/10 border border-slate-200/30 flex items-center justify-center text-slate-200">
                <GoatIcon className="w-7 h-7" />
              </div>
            </div>
          </div>
        </div>

        {/* Title Typography Hierarchy */}
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-100 leading-tight">
          Baghchal
        </h1>
        <p className="text-sm font-medium text-amber-400 mt-0.5 tracking-wide">
          बाघचाल · Strategic Board Game
        </p>

        <p className="text-xs text-stone-400 max-w-xs mt-3 leading-relaxed">
          Classic Himalayan tactical warfare. Command the 4 tigers or mobilize the herd of 20 goats to triumph.
        </p>

        {/* Action Button */}
        <div className="w-full max-w-xs mt-8">
          <button
            id="splash-play-button"
            onClick={onStartClick}
            className="w-full h-13 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-bold text-sm tracking-wide shadow-lg transition flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-stone-950" />
            <span>Play Match</span>
          </button>
        </div>
      </main>

      {/* Footer System Info */}
      <footer className="w-full max-w-md text-center text-xs text-stone-500 py-3 border-t border-stone-900">
        Version 1.0.9 · Resilient Dual-Signaling & P2P Engine
      </footer>
    </div>
  );
};
