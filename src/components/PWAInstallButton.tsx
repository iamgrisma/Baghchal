import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 px-3 py-1.5 text-xs font-semibold text-stone-950 shadow-md transition active:scale-95"
        title="Install Baghchal on your device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-install-ios-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-800/60 bg-stone-900/80 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-stone-800 transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Install PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-stone-800 bg-stone-900 p-6 shadow-2xl text-stone-200">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                  <Download className="w-4 h-4" /> Install on iOS
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-full p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-stone-300">
                <p className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-400 text-xs font-bold">1</span>
                  Tap the <Share className="w-4 h-4 text-sky-400 inline mx-1" /> <strong>Share</strong> button in the Safari toolbar.
                </p>
                <p className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-400 text-xs font-bold">2</span>
                  Scroll down and select <strong>Add to Home Screen</strong>.
                </p>
                <p className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-950 text-amber-400 text-xs font-bold">3</span>
                  Enjoy full-screen offline gameplay like a native app!
                </p>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-amber-600 hover:bg-amber-500 py-2.5 text-sm font-semibold text-stone-950 transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
