import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const triggerNativeHaptic = async (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning'
) => {
  if (!Capacitor.isNativePlatform()) {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      if (type === 'light') navigator.vibrate(15);
      if (type === 'medium') navigator.vibrate(30);
      if (type === 'heavy') navigator.vibrate(60);
      if (type === 'warning') navigator.vibrate([40, 60, 40]);
      if (type === 'success') navigator.vibrate([20, 40, 20]);
    }
    return;
  }

  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        await Haptics.notification({ type: NotificationType.Success });
        break;
      case 'warning':
        await Haptics.notification({ type: NotificationType.Warning });
        break;
    }
  } catch (err) {
    console.debug('Native haptics unavailable', err);
  }
};
