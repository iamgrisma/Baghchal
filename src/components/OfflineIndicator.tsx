import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="offline-indicator"
      className="fixed bottom-3 right-3 z-50 flex items-center gap-2 rounded-xl border border-amber-800/80 bg-stone-900/95 px-3 py-1.5 text-xs font-medium text-amber-300 shadow-xl backdrop-blur-md animate-fade-in"
    >
      <WifiOff className="w-3.5 h-3.5 text-amber-400" />
      <span>Offline Mode — Local &amp; AI game modes ready</span>
    </div>
  );
};
