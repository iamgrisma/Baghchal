export type PieceType = 'tiger' | 'goat';
export type BoardState = (PieceType | null)[][];
export type Turn = 'goat' | 'tiger';
export type Phase = 'placement' | 'movement';
export type GameMode = 'ai' | 'pvp' | 'online';
export type AIDifficulty = 'easy' | 'medium' | 'hard';
export type BoardTheme = 'classic' | 'nepali' | 'wood' | 'marble' | 'cathedral3d';

export interface Position {
  r: number;
  c: number;
}

export interface Move {
  from: Position | null;
  to: Position;
  type: 'place' | 'move' | 'capture';
  capturedPos?: Position;
}

export interface GameState {
  board: BoardState;
  turn: Turn;
  phase: Phase;
  goatsInHand: number;
  goatsKilled: number;
  gameOver: boolean;
  winner: Turn | null;
  moveHistory: Move[];
}

export interface UserProfile {
  name: string;
  avatar: string;
  rating: number;
  gamesPlayed: number;
  gamesWon: number;
}
