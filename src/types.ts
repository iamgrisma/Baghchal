/**
 * Baghchal Game Types and Interfaces
 */

export type PieceType = 'tiger' | 'goat' | null;

export type Board = PieceType[];

export type PlayerRole = 'tiger' | 'goat';

export type GameMode = 'ai' | 'local' | 'online';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export type GamePhase = 'placement' | 'movement';

export type GameStatus = 'playing' | 'tiger_won' | 'goat_won';

export interface Move {
  type: 'place' | 'step' | 'jump';
  from?: number; // 0..24
  to: number;   // 0..24
  captured?: number; // index of captured goat, if jump
  piece: 'tiger' | 'goat';
}

export interface GameState {
  board: (PieceType)[];
  turn: PlayerRole;
  goatsInReserve: number; // starts at 20, drops to 0
  goatsCaptured: number;  // 0 to 5
  phase: GamePhase;
  status: GameStatus;
  moveHistory: Move[];
  lastMove: Move | null;
}

export interface MatchHistoryItem {
  id: string;
  date: string;
  mode: GameMode;
  userRole: PlayerRole;
  opponent: string;
  result: 'won' | 'lost';
  goatsCaptured: number;
  totalTurns: number;
  durationSeconds: number;
}

export interface PlayerProfile {
  name: string;
  gamesPlayed: number;
  winsGoat: number;
  winsTiger: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  history: MatchHistoryItem[];
}

export interface OnlineRoomInfo {
  roomId: string;
  myRole: PlayerRole;
  opponentName: string;
  isInitiator: boolean;
  connected: boolean;
  usingP2P: boolean;
}
