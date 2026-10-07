import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

interface MobileLifecycleProps {
  currentScreen: 'splash' | 'setup' | 'play';
  onNavigateBack: () => void;
}

export function useMobileLifecycle({ currentScreen, onNavigateBack }: MobileLifecycleProps) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const configureNativeChrome = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#0c0a09' });
      } catch (err) {
        console.debug('StatusBar styling skipped', err);
      }
    };

    configureNativeChrome();

    const backListener = CapacitorApp.addListener('backButton', () => {
      if (currentScreen === 'play' || currentScreen === 'setup') {
        onNavigateBack();
      } else {
        CapacitorApp.exitApp();
      }
    });

    return () => {
      backListener.then((listener) => listener.remove());
    };
  }, [currentScreen, onNavigateBack]);
}
