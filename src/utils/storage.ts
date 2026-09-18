import { MatchHistoryItem, PlayerProfile } from '../types';

const STORAGE_KEY = 'baghchal_player_profile';

const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Baghchal Champion',
  gamesPlayed: 0,
  winsGoat: 0,
  winsTiger: 0,
  losses: 0,
  currentStreak: 0,
  bestStreak: 0,
  history: [],
};

export function loadPlayerProfile(): PlayerProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Failed to parse player profile from localStorage:', err);
    return DEFAULT_PROFILE;
  }
}

export function savePlayerProfile(profile: PlayerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Failed to save player profile to localStorage:', err);
  }
}

export function recordMatchResult(
  item: Omit<MatchHistoryItem, 'id' | 'date'>
): PlayerProfile {
  const profile = loadPlayerProfile();
  const isWin = item.result === 'won';

  const newHistoryItem: MatchHistoryItem = {
    ...item,
    id: `match_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    date: new Date().toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };

  const updated: PlayerProfile = {
    ...profile,
    gamesPlayed: profile.gamesPlayed + 1,
    winsGoat: profile.winsGoat + (isWin && item.userRole === 'goat' ? 1 : 0),
    winsTiger: profile.winsTiger + (isWin && item.userRole === 'tiger' ? 1 : 0),
    losses: profile.losses + (isWin ? 0 : 1),
    currentStreak: isWin ? profile.currentStreak + 1 : 0,
    bestStreak: isWin
      ? Math.max(profile.bestStreak, profile.currentStreak + 1)
      : profile.bestStreak,
    history: [newHistoryItem, ...profile.history].slice(0, 50), // keep last 50 matches
  };

  savePlayerProfile(updated);
  return updated;
}
