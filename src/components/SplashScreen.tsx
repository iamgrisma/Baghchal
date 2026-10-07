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
}) => {
  return (
    <div
      className="fixed inset-0 w-full h-full h-[100dvh] max-h-[100dvh] flex flex-col justify-between items-center bg-stone-950 text-stone-100 overflow-hidden select-none touch-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Top App Bar Header */}
      <header className="w-full max-w-md h-16 px-4 flex items-center justify-between shrink-0 border-b border-stone-900 bg-stone-950/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500 flex items-center justify-center text-stone-950 font-black text-xs shadow-sm">
            B
          </div>
          <span className="font-bold text-sm tracking-wide text-stone-200">BAGHCHAL</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 bg-stone-900/60 border border-stone-800/60 active:scale-95 transition"
            title="Records"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
          </button>
          <button
            onClick={onOpenRules}
            className="w-10 h-10 rounded-full flex items-center justify-center text-stone-400 hover:text-amber-400 bg-stone-900/60 border border-stone-800/60 active:scale-95 transition"
            title="Rules"
          >
            <BookOpen className="w-4 h-4 text-stone-300" />
          </button>
        </div>
      </header>

      {/* Main Material Hero Surface */}
      <main className="w-full max-w-md flex-1 flex flex-col items-center justify-center text-center px-6 py-4 z-10 gpu-accelerated">
        {/* Crest Elevation Card */}
        <div className="relative mb-5">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl flex items-center justify-center relative overflow-hidden">
            <div className="flex items-center justify-center gap-3">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <TigerIcon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-200/10 border border-slate-200/30 flex items-center justify-center text-slate-200">
                <GoatIcon className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
            </div>
          </div>
        </div>

        {/* Title Typography Hierarchy */}
        <h1 className="text-3xl font-black tracking-tight text-stone-100 leading-tight">
          Baghchal
        </h1>
        <p className="text-sm font-semibold text-amber-400 mt-0.5 tracking-wide">
          बाघचाल · Authentic Strategic Board Game
        </p>

        <p className="text-xs text-stone-400 max-w-xs mt-2.5 leading-relaxed">
          Classic Himalayan tactical warfare. Command the 4 tigers or mobilize the herd of 20 goats to victory.
        </p>

        {/* Action Button */}
        <div className="w-full max-w-xs mt-6">
          <button
            id="splash-play-button"
            onClick={onStartClick}
            className="w-full h-12 rounded-2xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 font-black text-sm tracking-wide shadow-xl transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-stone-950" />
            <span>Play Match</span>
          </button>
        </div>
      </main>

      {/* Footer System Info */}
      <footer className="w-full max-w-md shrink-0 text-center text-[11px] text-stone-500 py-2.5 border-t border-stone-900">
        Version 1.1.4 · Native Mobile Edition
      </footer>
    </div>
  );
};
