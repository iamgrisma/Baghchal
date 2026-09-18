import React from 'react';
import { ChevronRight, BookOpen, Trophy, Shield, Sparkles } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

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
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-stone-950 text-stone-100 overflow-hidden px-4 py-6 select-none">
      {/* Ambient background brass glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 sm:w-96 h-80 sm:h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-64 h-64 bg-orange-600/5 rounded-full blur-2xl pointer-events-none" />

      {/* Top Bar with Badge & PWA */}
      <header className="w-full max-w-md flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-stone-900/80 border border-stone-800 text-[11px] text-amber-400 font-semibold shadow">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Nepali Heritage Board Game</span>
        </div>

        <div>
          {isTelegram ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-[11px] font-semibold text-sky-300 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span>Telegram TMA</span>
            </div>
          ) : (
            <PWAInstallButton />
          )}
        </div>
      </header>

      {/* Hero Center Emblem and Branding */}
      <main className="w-full max-w-md flex flex-col items-center text-center my-auto z-10 py-6">
        {/* Traditional Mandala & Dual Tiger/Goat Emblem */}
        <div className="relative mb-6">
          {/* Animated decorative spinning ring */}
          <div className="absolute -inset-3 rounded-full border border-amber-500/25 border-dashed animate-[spin_40s_linear_infinite] pointer-events-none" />
          <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-amber-600/30 to-orange-500/10 blur-sm pointer-events-none" />

          {/* Central Crest */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-b from-stone-900 via-stone-925 to-stone-950 p-1 border-2 border-amber-500/50 shadow-2xl flex flex-col items-center justify-center">
            <div className="flex items-center justify-center gap-2 text-3xl sm:text-4xl">
              <span role="img" aria-label="Tiger" className="drop-shadow">🐅</span>
              <span className="text-amber-500 font-black text-xl">VS</span>
              <span role="img" aria-label="Goat" className="drop-shadow">🐐</span>
            </div>
            <div className="text-[10px] font-mono tracking-widest text-amber-400/80 font-bold uppercase mt-1">
              4 Tigers · 20 Goats
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-stone-100 flex flex-col items-center">
          <span className="text-amber-400 drop-shadow-md">BAGHCHAL</span>
          <span className="text-xl sm:text-2xl font-bold text-stone-400 tracking-wider font-serif -mt-1">
            बाघचाल
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-stone-400 max-w-xs mt-3 leading-relaxed">
          The royal two-player asymmetric strategy game of Nepal. Trap the 4 ferocious tigers, or hunt 5 goats to triumph!
        </p>

        {/* Big Forward Action Button: `>` */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            id="splash-play-button"
            onClick={onStartClick}
            aria-label="Start Game"
            className="group relative flex items-center justify-center w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-stone-950 font-black shadow-xl shadow-amber-500/25 transition-all duration-300 hover:scale-105 active:scale-95 ring-4 ring-amber-400/30 hover:ring-amber-400/60"
          >
            {/* Pulsing ring animation */}
            <span className="absolute -inset-1 rounded-full bg-amber-400/40 animate-ping opacity-40 pointer-events-none" />
            
            {/* The iconic `>` button icon */}
            <ChevronRight className="w-11 h-11 transition-transform duration-200 group-hover:translate-x-1 stroke-[3]" />
          </button>
          
          <span className="text-[11px] font-bold tracking-widest text-amber-400/90 uppercase">
            Tap &gt; to Play
          </span>
        </div>
      </main>

      {/* Bottom Menu: Rules & Stats */}
      <footer className="w-full max-w-md flex items-center justify-center gap-3 z-10 pt-4 border-t border-stone-900/80">
        <button
          id="splash-rules-btn"
          onClick={onOpenRules}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900/80 hover:bg-stone-800/90 border border-stone-800 text-xs font-semibold text-stone-300 transition active:scale-98 shadow"
        >
          <BookOpen className="w-4 h-4 text-amber-400" />
          <span>Game Rules</span>
        </button>

        <button
          id="splash-profile-btn"
          onClick={onOpenProfile}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900/80 hover:bg-stone-800/90 border border-stone-800 text-xs font-semibold text-stone-300 transition active:scale-98 shadow"
        >
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>My Records</span>
        </button>
      </footer>
    </div>
  );
};
