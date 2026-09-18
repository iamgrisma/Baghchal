/**
 * Telegram Mini App (TMA) Integration Helper
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          query_id?: string;
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
            photo_url?: string;
          };
          start_param?: string;
          auth_date?: string;
          hash?: string;
        };
        version: string;
        platform: string;
        colorScheme: 'light' | 'dark';
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        enableClosingConfirmation?: () => void;
        disableVerticalSwipes?: () => void;
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string, options?: { try_instant_view?: boolean }) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.Telegram?.WebApp?.initData !== undefined && window.Telegram.WebApp.initData !== '');
}

export function initTelegramWebApp(): void {
  if (typeof window === 'undefined') return;
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return;

  try {
    webApp.ready();
    webApp.expand();

    if (webApp.setHeaderColor) {
      webApp.setHeaderColor('#0c0a09');
    }
    if (webApp.setBackgroundColor) {
      webApp.setBackgroundColor('#0c0a09');
    }
    if (webApp.disableVerticalSwipes) {
      webApp.disableVerticalSwipes();
    }
  } catch (err) {
    console.warn('Failed to fully initialize Telegram WebApp API:', err);
  }
}

export function getTelegramUser(): {
  id?: number;
  name: string;
  username?: string;
  photoUrl?: string;
} | null {
  if (typeof window === 'undefined') return null;
  const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
  if (!user) return null;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return {
    id: user.id,
    name: fullName || user.first_name || 'Telegram Player',
    username: user.username,
    photoUrl: user.photo_url,
  };
}

export function getTelegramStartParam(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Check Telegram initDataUnsafe.start_param
  const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
  if (startParam) return startParam;

  // 2. Check URL query string (?room=... or ?tgWebAppStartParam=...)
  const params = new URLSearchParams(window.location.search);
  const room = params.get('room') || params.get('tgWebAppStartParam');
  if (room) return room;

  // 3. Check hash params
  if (window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const hashRoom = hashParams.get('tgWebAppStartParam') || hashParams.get('room');
    if (hashRoom) return hashRoom;
  }

  return null;
}

export function triggerTelegramHaptic(
  type: 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error'
): void {
  if (typeof window === 'undefined') return;
  const haptic = window.Telegram?.WebApp?.HapticFeedback;
  if (!haptic) return;

  try {
    if (type === 'light' || type === 'medium' || type === 'heavy') {
      haptic.impactOccurred(type);
    } else if (type === 'selection') {
      haptic.selectionChanged();
    } else if (type === 'success' || type === 'warning' || type === 'error') {
      haptic.notificationOccurred(type);
    }
  } catch (e) {
    // Fail silently if not supported
  }
}

export function shareViaTelegram(text: string, url?: string): void {
  if (typeof window === 'undefined') return;

  const shareUrl = url || window.location.href;
  const tgShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`;

  const webApp = window.Telegram?.WebApp;
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(tgShareUrl);
  } else {
    window.open(tgShareUrl, '_blank');
  }
}
