export type PieceType = 'tiger' | 'goat' | null;

export type Board = PieceType[];

export type PlayerRole = 'tiger' | 'goat';

export type GameMode = 'ai' | 'local' | 'online';

export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

export type GamePhase = 'placement' | 'movement';

export type GameStatus = 'playing' | 'tiger_won' | 'goat_won' | 'draw';

export type BoardTheme = 'classic' | 'slate' | 'midnight';

export type TimerMode = 'unlimited' | 'turn30s' | 'blitz5m';

export interface Move {
  type: 'place' | 'step' | 'jump';
  from?: number;
  to: number;
  captured?: number;
  piece: 'tiger' | 'goat';
}

export interface GameState {
  board: PieceType[];
  turn: PlayerRole;
  goatsInReserve: number;
  goatsCaptured: number;
  phase: GamePhase;
  status: GameStatus;
  moveHistory: Move[];
  lastMove: Move | null;
}

export interface MatchRecord {
  id: string;
  date: string;
  mode: GameMode;
  userRole: PlayerRole;
  opponent: string;
  result: 'won' | 'lost' | 'draw';
  goatsCaptured: number;
  totalTurns: number;
  durationSeconds: number;
}

export type MatchHistoryItem = MatchRecord;

export type RematchStatus = 'idle' | 'requested_by_me' | 'requested_by_opponent' | 'accepted';

export type ConnectionHealth = 'connected' | 'reconnecting' | 'opponent_offline' | 'local_offline' | 'disconnected';

export type SignalingTier = 'durable_object' | 'redis_kv' | 'emergency_relay' | 'disconnected';

export interface PlayerProfile {
  name: string;
  gamesPlayed: number;
  winsGoat: number;
  winsTiger: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  history: MatchRecord[];
}

export interface OnlineRoomInfo {
  roomId: string;
  myRole: PlayerRole;
  opponentName: string;
  isInitiator: boolean;
  connected: boolean;
  usingP2P: boolean;
}

export interface LeaderboardPlayer {
  id: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  tigersTrapped: number;
  goatsCaptured: number;
  updatedAt: number;
}
